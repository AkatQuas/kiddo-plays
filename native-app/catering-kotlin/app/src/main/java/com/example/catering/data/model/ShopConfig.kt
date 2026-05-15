package com.example.catering.data.model

@kotlinx.serialization.Serializable
data class ShopConfig(
    val shopName: String = "我的小店",
    val businessHours: String = "09:00-22:00",
    val isFirstLaunch: Boolean = true
)