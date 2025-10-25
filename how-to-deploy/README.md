#  PingU – Real-Time Messaging Platform

PingU is a **real-time messaging application** developed as the final deliverable for the _Management and Administration of IT Infrastructures and Services_ course project (AGISIT25 – Group 33).

The project explores the **practical challenges of building low-latency, reliable communication systems** while maintaining the **deployment discipline and modularity** expected in cloud-native environments.

Our goal was to design a **minimal yet representative system** that demonstrates sound infrastructure practices, from microservice architecture and CI/CD automation to cloud deployment and monitoring.

---

##  Overview

PingU consists of multiple independent microservices that communicate via HTTP:

| Service | Port | Description |
|----------|------|-------------|
| `message-service` | `8000` | Handles message creation, retrieval, and delivery |
| `user-service` | `8001` | Manages user registration, authentication, and sessions |
| `group-service` | `8002` |  Intended to manage group creation and membership |

### Architecture Highlights
- **Microservice-oriented design** with isolated services and separate databases  
- **Google Cloud Platform (GCP)** deployment with reproducible scripts  
- **GitLab CI/CD** pipeline for automated build and deployment  
- **“just” commands** used for streamlined local operations  
- **Focus on latency and throughput measurement** to analyze system performance  

---

##  Environment Configuration

The following environment variables are required to interconnect services:

```bash
MESSAGE_SERVICE_URL=http://message-service:8000/
USER_SERVICE_URL=http://user-service:8001/
GROUP_SERVICE_URL=http://group-service:8002/
```

---

##  Pre-Requisites

Before building and deploying PingU, make sure you have:

- A **Google Cloud Platform (GCP)** project  
- Installed tools:  
  - `gcloud` CLI  
  - `docker`  
  - `just` command runner  
  - `bash` shell  
- SSH key pair for GitLab Runner access  

---

##  Setup & Deployment

Follow the steps below to get the system running in a fully operational environment.

### 1️⃣ Generate and Configure GCP Credentials

1. Generate credentials for your GCP service account.  
2. Move the generated file into the `/gcpcloud` directory.  
3. Rename it to:

   ```
   agisit25-g33-1b9e4368baa2.json
   ```

---

### 2️⃣ Configure SSH Keys for CI/CD

- Add your **public SSH key** to **GCloud**.  
- Add your **private SSH key** to **GitLab** (for the CI/CD runner).  

This enables seamless automated deployment during each pipeline execution.

---

### 3️⃣ Start the GitLab Runner VM

Once credentials and keys are configured, start the VM that hosts the GitLab runner:

```bash
gcloud compute instances start gitlab-runner-vm --zone=us-west1-c
```

---

### 4️⃣ Deploy the Application

To deploy the application to GCP, execute the following commands from the project root:

```bash
just start
just mgmt
cd gcpcloud
bash deploy.sh
```

This sequence will:
- Build and start all microservices  
- Set up management configurations  
- Deploy the services to GCP using the credentials provided  

---

### 5️⃣ Continuous Integration / Continuous Deployment

- Every **push to the main branch** automatically triggers the **GitLab CI/CD pipeline**.
- The pipeline builds, tests, and redeploys the application if the tests pass.

**Note:**  
During final testing, **the Groups microservice** encountered some issues and is **not fully operational** in the current version. The rest of the system remains deployable and functional.

---

## 🧑‍💻 Authors

**Group 33 – AGISIT 2025**  
- Vasco Pires  ist1106341
- Tiago Raposo  ist1119016
- Pedro Simões ist1116257

---

> _“If it builds, deploys, and pings — it’s alive.”_
