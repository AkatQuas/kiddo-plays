package com.example.gatewaydemo;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * UriConfiguration
 */
@ConfigurationProperties
public class UriConfiguration {

  private String httpbin = "http://httpbin.org:80";

  public String getHttpbin() {
    return httpbin;
  }

  public void setHttpbin(String httpbin) {
    this.httpbin = httpbin;

  }
}
