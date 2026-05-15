package com.example.catering.data.repository

import android.content.Context
import com.example.catering.data.model.Order
import com.example.catering.data.model.OrderStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class OrderRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val ordersFile: File
        get() = File(context.filesDir, "orders.json")

    suspend fun saveOrder(order: Order) = withContext(Dispatchers.IO) {
        val orders = getAllOrders().toMutableList()
        val existingIndex = orders.indexOfFirst { it.id == order.id }
        if (existingIndex >= 0) {
            orders[existingIndex] = order
        } else {
            orders.add(0, order)
        }
        saveAllOrders(orders)
    }

    suspend fun getOrderById(id: String): Order? = withContext(Dispatchers.IO) {
        getAllOrders().find { it.id == id }
    }

    suspend fun getAllOrders(): List<Order> = withContext(Dispatchers.IO) {
        if (!ordersFile.exists()) return@withContext emptyList()
        try {
            json.decodeFromString<List<Order>>(ordersFile.readText())
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getOrdersByStatus(status: OrderStatus): List<Order> = withContext(Dispatchers.IO) {
        getAllOrders().filter { it.status == status }
    }

    suspend fun updateOrderStatus(id: String, status: OrderStatus) = withContext(Dispatchers.IO) {
        val orders = getAllOrders().toMutableList()
        val index = orders.indexOfFirst { it.id == id }
        if (index >= 0) {
            orders[index] = orders[index].copy(status = status)
            saveAllOrders(orders)
        }
    }

    suspend fun deleteOrder(id: String) = withContext(Dispatchers.IO) {
        val orders = getAllOrders().toMutableList()
        orders.removeAll { it.id == id }
        saveAllOrders(orders)
    }

    private fun saveAllOrders(orders: List<Order>) {
        ordersFile.writeText(json.encodeToString(orders))
    }
}