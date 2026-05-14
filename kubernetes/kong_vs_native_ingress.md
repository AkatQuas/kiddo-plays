# Kong vs Native Nginx Ingress Architecture

# 1. Basic Pre-Knowledge (Must-Know)

## 1.2 Two Easily Confused K8s Concepts

- **Ingress (Resource)**: Merely a **routing configuration file**. It defines domains, request paths, and forwarding rules. It does **not** handle traffic by itself.

- **Ingress Controller (Gateway)**: The actual program that listens to and forwards traffic. It is the real traffic entry point.

> Simple Analogy: **Ingress = Blueprint, Ingress Controller = Construction Worker.**

## 1.2 What is KIC? (Kong Ingress Controller)

- **Definition**: KIC is the dedicated control-plane component for Kong in Kubernetes.

- **Core Responsibility**: It continuously watches the Kubernetes API to detect changes of Ingress, Service, and Endpoint resources.

- **Working Mechanism**: KIC automatically translates standard K8s resource rules into Kong-native configurations (Services, Routes, Upstreams), then pushes them to the Kong gateway data plane.

- **Key Feature**: Zero downtime configuration updates; no Kong restart required. It decouples traffic control from traffic forwarding.

# 2. Traffic Architecture Flow

## 2.1 Traditional Nginx Ingress (K8s Native)

### Traffic Flow

```plain
External Request
        ↓
Nginx Ingress Pod (Single Entry)
        ↓
Load Ingress Config + Service List
        ↓
Forward via Kube-Proxy
        ↓
Business Pod
```

### Architecture Features

- Nginx acts as both **gateway entry** and controller

- All traffic must pass through the Nginx layer

- Backend forwarding relies on K8s Service, **kube-proxy is mandatory**

## 2.2 Kong Gateway (Modern API Gateway)

### Traffic Flow

```plain
External Request
        ↓
Kong Gateway Pod (Single Entry)
        ↓
[Background] KIC actively monitors K8s:
    Fetch Ingress / Service / Endpoints
        ↓
Kong internal processing: Generate routes & upstream node pools
        ↓
Directly forward to business Pod (bypass kube-proxy)
```

### Architecture Features

- **Kong itself is an Ingress Controller**, replacing Nginx

- Ingress **only serves as configuration, no traffic participation**

- Kong perceives real Pod IPs directly, **bypassing Service and kube-proxy**

# 3. Core Principle Differences (Key Focus)

## 3.1 Service Discovery Mechanism

- **Nginx Ingress**:
  - Monitors Endpoints but forwards traffic via ClusterIP

  - Relies on kube-proxy for underlying load balancing

  - Limited load-balancing algorithms (Round Robin, IP Hash)

- **Kong**:
  - KIC fetches all real Pod IPs and stores them in Kong internal Upstream

  - **Direct Pod connection, skip kube-proxy**

  - Built-in health check, circuit breaking, retry and advanced load balancing

## 3.2 Architecture Model Difference

- **Nginx Ingress: Control Plane + Data Plane Combined**
  Configuration changes require Nginx reload; heavy and limited capability.

- **Kong: Separate Control Plane(KIC) + Data Plane(Gateway)**
  Dynamic configuration updates without traffic interruption; higher performance and richer plugins.

# 4. Performance &amp; Capability Comparison

| **Comparison Item**       | **Nginx Ingress**                    | **Kong Gateway**                                             |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Single Pod QPS            | 3k~5k                                | **8k~15k**                                                   |
| WebSocket Long Connection | Supported, complicated configuration | **Native excellent support**                                 |
| Service Discovery         | Depend on kube-proxy                 | **Direct Pod access + Active Health Check**                  |
| Plugin Ecosystem          | Very few                             | JWT / Rate Limit / Circuit Breaking / Gray Release / Logging |
| Applicable Scenarios      | Simple static routing                | Microservices, complex business, AI long connection          |

# 5. Plain Language Summary (For Sharing)

1. **Nginx Ingress: Simple, official, lightweight**
   Suitable for pure HTTP forwarding with low complexity. Extra kube-proxy layer increases forwarding latency.

2. **Kong: Professional API Gateway, a superset of Ingress**
   Kong acts as the traffic entry and actively monitors K8s resources. **Ingress only provides configuration data for Kong.**
   Traffic bypasses redundant components and connects to Pods directly, bringing higher performance and abundant plugins for microservices.

3. **Core One-Sentence Conclusion**:
   Native Ingress is a **lightweight gateway designed for vanilla K8s**;
   Kong is a **production-grade API gateway oriented to complex business microservices**.
