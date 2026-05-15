package com.example.catering.data.model

enum class OrderStatus {
    UNPAID,
    PAID,
    COMPLETED
}

@kotlinx.serialization.Serializable
data class OrderItem(
    val dishId: String,
    val dishName: String,
    val price: Float,
    val quantity: Int = 1
)

@kotlinx.serialization.Serializable
data class Order(
    val id: String = java.util.UUID.randomUUID().toString(),
    val items: List<OrderItem> = emptyList(),
    val amount: Float = 0f,
    val status: OrderStatus = OrderStatus.UNPAID,
    val remark: String = "",
    val createTime: Long = System.currentTimeMillis()
)