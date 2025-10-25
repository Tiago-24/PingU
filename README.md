# 🌐 Cloud-Native Microservices Infrastructure on GCP

This project implements a **cloud-native, microservices-based application** deployed on **Google Cloud Platform (GCP)**.  
It showcases a complete **DevOps automation pipeline**, integrating **React**, **FastAPI (Python)**, **Prometheus/ Grafana**, **Kubernetes**, **Terraform**, and **Ansible** into one cohesive system — from code to running infrastructure.

---

## 🚀 Project Overview

The goal of this project is to demonstrate how to build, automate, and deploy a scalable microservices architecture in the cloud.  
It combines both **application development** and **infrastructure automation** to simulate a real-world production setup.

The system runs a set of interconnected microservices that communicate through internal APIs, exposed to the user via a modern web interface.  
Each part of the stack has been selected to reflect industry-standard DevOps practices.

---

## 🧠 Tech Stack

### 💻 Frontend
- **React.js** — A responsive and dynamic web interface built with modern JavaScript and component-based architecture.  
- **Fetch** — Used for REST API communication with backend microservices.

### ⚙️ Backend
- **Python (FastAPI)** — Lightweight and fast web framework to build the microservices (User, Group, and Message services).  
- **Uvicorn** — High-performance ASGI server for serving FastAPI applications.  
- **REST APIs** — Each service exposes REST endpoints for communication with others and the frontend.

### ☸️ Orchestration and Infrastructure
- **Kubernetes** — Container orchestration platform that manages all microservices, handles load balancing, scaling, and automatic failover.  
- **Terraform** — Infrastructure as Code (IaC) tool used to provision GCP resources such as virtual machines, networking, firewalls, and service accounts.  
- **Ansible** — Automates configuration management across the infrastructure. It installs necessary dependencies, initializes the Kubernetes cluster, joins worker nodes, and deploys workloads seamlessly.  
- **Docker** — Containerizes each FastAPI microservice and the React frontend for consistent builds and easy deployment across environments.  
- **Prometheus** — Collects real-time metrics from Kubernetes components, pods, and services to monitor performance and system health. It serves as the core monitoring and alerting system for the cluster.  
- **Grafana** — Visualization layer built on top of Prometheus. It provides rich, interactive dashboards that display metrics for CPU usage, memory consumption, network traffic, and application performance.  
  - Dashboards automatically provisioned through Helm and configured to use Prometheus as the default data source.  
  - Enables observability across both infrastructure and application layers, allowing proactive troubleshooting and performance optimization.  
- **Helm** — Used to manage the installation and configuration of monitoring tools like Grafana and Prometheus within Kubernetes, ensuring reproducible and maintainable deployments.


### ☁️ Cloud Platform
- **Google Cloud Platform (GCP)** — Hosts all infrastructure and provides compute instances for the Kubernetes cluster.  
- **Service Account Authentication** — Managed through GCP credentials to automate Terraform and Ansible actions.

---

## 🧩 Architecture Summary

At a high level, the system is composed of:
- **Frontend Service** — Built with React, interacting with backend services via REST.  
- **User Service** — Manages user data and authentication (FastAPI).  
- **Group Service** — Handles group creation and associations between users (FastAPI).  
- **Message Service** — Manages message routing between groups and users (FastAPI).  
- **Shared Environment** — Defines common configuration variables across services.

These microservices are deployed inside a **Kubernetes cluster** that is automatically created and configured using **Terraform** and **Ansible**, allowing for complete automation from provisioning to application deployment.

---

## 🔁 Workflow Overview

1. **Terraform** provisions the base cloud infrastructure on GCP.  
2. **Ansible** connects to the provisioned instances, installs Kubernetes components, and bootstraps the cluster.  
3. **Dockerized FastAPI services** are deployed to the cluster alongside the **React frontend**.  
4. **Kubernetes** manages all services, providing scalability, rolling updates, and high availability.  

This creates a fully functional, cloud-native environment with end-to-end automation — from infrastructure to application.

---

## 📘 Deployment

To deploy and run this system, please refer to the detailed guide:  
👉 [**how-to-deploy/deployment.md**](how-to-deploy/README.md)

It explains how to:
- Authenticate with GCP  
- Run Terraform and Ansible automation  
- Deploy and access the full microservices application  

> _“If it builds, deploys, and pings — it’s alive.”_
