package com.example.catering.data.model

@kotlinx.serialization.Serializable
data class Dish(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val price: Float,
    val category: String = "默认分类",
    val inStock: Boolean = true
)