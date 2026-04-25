---
title: config
description: 记录 Clash config.yaml 常用配置片段，包括订阅转换、TUN、DNS 与流量嗅探等选项，方便快速复用。
order: 1
outline: deep
head:
  - - meta
    - name: keywords
      content: Clash,config.yaml,订阅转换,TUN,DNS,sniffer,代理配置
---

# config

## 订阅转换
[SubBoost](https://subboost.org/)

## 覆写配置
```yaml
ipv6: false

# TUN 配置
tun:
  enable: true
  loopback-address:
    - 10.7.0.1

# DNS 配置
dns:
  enable: true
  ipv6: false

# 域名/流量嗅探
sniffer:
  enable: false
```
