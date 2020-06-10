package com.example.gatewaydemo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.publisher.Mono;

@SpringBootApplication
@EnableConfigurationProperties(UriConfiguration.class)
@RestController
public class GateWaydemoApplication {

	public static void main(String[] args) {
		SpringApplication.run(GateWaydemoApplication.class, args);
	}

	@Bean
	public RouteLocator myRoutes(RouteLocatorBuilder builder, UriConfiguration uriConfiguration) {
		String httpUri = uriConfiguration.getHttpbin();
		return builder.routes()
				.route("path_route", p -> p.path("/get").filters(f -> f.addRequestHeader("hello", "T2")).uri(httpUri))
				.route(p -> p.host("*.hystrix.com")
						.filters(f -> f.hystrix(config -> config.setName("mycmd").setFallbackUri("forward:/fallback")))
						.uri(httpUri))
				.route("rewrite_route",
						r -> r.host("*.rewrite.org").filters(f -> f.rewritePath("/foo/(?<segment>.*)", "/${segment}")).uri(httpUri))
				// .route("limit_route", r -> r.host("*.limited.org").and().path("/anything/**")
				// .filters(f -> f.requestRateLimiter(c ->
				// c.setRateLimiter(redisRateLimiter()))).uri("http://httpbin.org"))
				.build();
	}

	@RequestMapping("/fallback")
	public Mono<String> fallback() {
		return Mono.just("fallback");
	}

}
