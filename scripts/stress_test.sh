#!/usr/bin/env bash

URL="http://34.83.154.71:31396/"
THREADS=4
CONCURRENCY=8
DURATION="30s"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LUA_REGISTER="$SCRIPT_DIR/register_stress.lua"
LUA_GET="$SCRIPT_DIR/getuser_stress.lua"

OUT_DIR="$SCRIPT_DIR/results"
mkdir -p "$OUT_DIR"

SUMMARY_REGISTER="$OUT_DIR/summary_register.csv"
SUMMARY_GET="$OUT_DIR/summary_get.csv"

echo "rate,avg_latency,requests_per_sec,throughput" > "$SUMMARY_REGISTER"
echo "rate,avg_latency,requests_per_sec,throughput" > "$SUMMARY_GET"

# Perform register stress tests
rate=1
for i in {1..12}; do
  OUT_FILE="$OUT_DIR/results_register_r${rate}.txt"
  echo "Running: wrk2 -t${THREADS} -c${CONCURRENCY} -d${DURATION} -R${rate} -s ${LUA_REGISTER} ${URL}"
  wrk2 -t"$THREADS" -c"$CONCURRENCY" -d"$DURATION" -R"$rate" -s "$LUA_REGISTER" "$URL" > "$OUT_FILE"
  echo "Saved -> $OUT_FILE"

  # Parse metrics
  avg_lat="$(awk '/^[[:space:]]*Latency/{print $2; exit}' "$OUT_FILE")"
  rps="$(awk -F: '/^Requests\/sec:/{gsub(/^[ \t]+/, "", $2); print $2; exit}' "$OUT_FILE")"
  thrput_raw="$(awk -F: '/^Transfer\/sec:/{gsub(/^[ \t]+/, "", $2); print $2; exit}' "$OUT_FILE")"
  thrput_bps="$(awk -v v="$thrput_raw" 'BEGIN{gsub(/ /,"",v);
    if (match(v,/^([0-9.]+)([KMG]?B)$/ ,a)) {
      n=a[1]+0; u=a[2]; m=1
      if(u=="KB") m=1024
      else if(u=="MB") m=1024*1024
      else if(u=="GB") m=1024*1024*1024
      printf "%.0f", n*m
    }}')"
  # Print and append to summary
  echo "rate=$rate avg_latency=$avg_lat requests_per_sec=$rps"
  echo "$rate,$avg_lat,$rps,$thrput_bps" >> "$SUMMARY_REGISTER"

  rate=$((rate * 2))
  sleep 1
done


# Perform get user stress tests
rate=1
for i in {1..12}; do
  OUT_FILE="$OUT_DIR/results_get_r${rate}.txt"
  echo "Running: wrk2 -t${THREADS} -c${CONCURRENCY} -d${DURATION} -R${rate} -s ${LUA_GET} ${URL}"
  wrk2 -t"$THREADS" -c"$CONCURRENCY" -d"$DURATION" -R"$rate" -s "$LUA_GET" "$URL" > "$OUT_FILE"
  echo "Saved -> $OUT_FILE"

  # Parse metrics
  avg_lat="$(awk '/^[[:space:]]*Latency/{print $2; exit}' "$OUT_FILE")"
  rps="$(awk -F: '/^Requests\/sec:/{gsub(/^[ \t]+/, "", $2); print $2; exit}' "$OUT_FILE")"
  thrput_raw="$(awk -F: '/^Transfer\/sec:/{gsub(/^[ \t]+/, "", $2); print $2; exit}' "$OUT_FILE")"
  thrput_bps="$(awk -v v="$thrput_raw" 'BEGIN{gsub(/ /,"",v);
    if (match(v,/^([0-9.]+)([KMG]?B)$/ ,a)) {
      n=a[1]+0; u=a[2]; m=1
      if(u=="KB") m=1024
      else if(u=="MB") m=1024*1024
      else if(u=="GB") m=1024*1024*1024
      printf "%.0f", n*m
    }}')"
  # Print and append to summary
  echo "rate=$rate avg_latency=$avg_lat requests_per_sec=$rps"
  echo "$rate,$avg_lat,$rps,$thrput_bps" >> "$SUMMARY_GET"

  rate=$((rate * 2))
  sleep 1
done


