import csv
import re
import argparse
from pathlib import Path
import matplotlib.pyplot as plt

def parse_latency_to_ms(v: str) -> float:
    v = (v or "").strip()
    m = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*(us|ms|s)?$", v, re.IGNORECASE)
    if not m:
        raise ValueError(f"Unrecognized latency format: {v!r}")
    val = float(m.group(1))
    unit = (m.group(2) or "ms").lower()
    if unit == "s":
        return val * 1000.0
    if unit == "ms":
        return val
    if unit == "us":
        return val / 1000.0
    raise ValueError(f"Unknown unit: {unit}")

def resolve_csv_path(arg_path: str) -> Path:
    p = Path(arg_path)
    if p.exists():
        return p
    here = Path(__file__).parent
    cand = here / arg_path
    if cand.exists():
        return cand
    cand = here / "results" / Path(arg_path).name
    if cand.exists():
        return cand
    return p  # will fail later

def main():
    ap = argparse.ArgumentParser(description="Plot stress test summary CSV.")
    ap.add_argument("summary", help="Path or name of summary CSV (e.g., results/summary.csv or summary_get.csv)")
    args = ap.parse_args()

    csv_path = resolve_csv_path(args.summary)
    if not csv_path.exists():
        raise SystemExit(f"Summary CSV not found: {csv_path}")

    out_dir = csv_path.parent
    out_img = out_dir / (csv_path.stem + "_summary.png")

    rates, rps, lat_ms, thr_bps = [], [], [], []

    with csv_path.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            rate = float(row["rate"])

            # Latency
            if "avg_latency_ms" in row and row["avg_latency_ms"]:
                latency_ms = float(row["avg_latency_ms"])
            else:
                latency_ms = parse_latency_to_ms(row["avg_latency"])

            # Requests per second
            req_per_sec = float(row["requests_per_sec"])

            # Throughput (raw bytes)
            thr_raw = row.get("transfer_per_sec", "") or row.get("throughput", "") or row.get("throughput_per_sec", "")
            thr = float(thr_raw) if thr_raw else None

            rates.append(rate)
            rps.append(req_per_sec)
            lat_ms.append(latency_ms)
            thr_bps.append(thr)

    ticks = sorted(set(rates))

    fig, axes = plt.subplots(3, 1, figsize=(9, 9), sharex=True)

    # Processed requests/sec
    axes[0].plot(rates, rps, marker="o")
    axes[0].set_ylabel("Processed requests/sec")
    axes[0].grid(True, linestyle=":")

    # Average latency
    axes[1].plot(rates, lat_ms, marker="o", color="tab:orange")
    axes[1].set_ylabel("Avg latency (ms)")
    axes[1].grid(True, linestyle=":")

    # Throughput (B/s)
    rate_thr = [r for r, t in zip(rates, thr_bps) if t is not None]
    thr_b_s = [t for t in thr_bps if t is not None]
    axes[2].plot(rate_thr, thr_b_s, marker="o", color="tab:green")
    axes[2].set_xlabel("Sent requests per second (rate)")
    axes[2].set_ylabel("Throughput (B/s)")
    axes[2].grid(True, linestyle=":")

    # Use logarithmic x-scale for clearer spacing
    for ax in axes:
        ax.set_xscale("log", base=2)

    # Set ticks and labels
    axes[-1].set_xticks(rates)
    axes[-1].set_xticklabels([str(int(r)) for r in rates])

    fig.suptitle(f"wrk2 summary — {csv_path.name}")
    fig.tight_layout()
    fig.savefig(out_img, dpi=150)
    print(f"Saved {out_img}")

if __name__ == "__main__":
    main()
