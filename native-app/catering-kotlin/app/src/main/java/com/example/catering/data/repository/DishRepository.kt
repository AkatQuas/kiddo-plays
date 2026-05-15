package com.example.catering.data.repository

import android.content.Context
import com.example.catering.data.model.Dish
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class DishRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val dishesFile: File
        get() = File(context.filesDir, "dishes.json")

    suspend fun saveDish(dish: Dish) = withContext(Dispatchers.IO) {
        val dishes = getAllDishes().toMutableList()
        val existingIndex = dishes.indexOfFirst { it.id == dish.id }
        if (existingIndex >= 0) {
            dishes[existingIndex] = dish
        } else {
            dishes.add(dish)
        }
        saveAllDishes(dishes)
    }

    suspend fun getDishById(id: String): Dish? = withContext(Dispatchers.IO) {
        getAllDishes().find { it.id == id }
    }

    suspend fun getAllDishes(): List<Dish> = withContext(Dispatchers.IO) {
        if (!dishesFile.exists()) return@withContext getDefaultDishes()
        try {
            val dishes = json.decodeFromString<List<Dish>>(dishesFile.readText())
            if (dishes.isEmpty()) getDefaultDishes() else dishes
        } catch (e: Exception) {
            getDefaultDishes()
        }
    }

    suspend fun getDishesByCategory(category: String): List<Dish> = withContext(Dispatchers.IO) {
        getAllDishes().filter { it.category == category }
    }

    suspend fun deleteDish(id: String) = withContext(Dispatchers.IO) {
        val dishes = getAllDishes().toMutableList()
        dishes.removeAll { it.id == id }
        saveAllDishes(dishes)
    }

    suspend fun updateDish(dish: Dish) = withContext(Dispatchers.IO) {
        val dishes = getAllDishes().toMutableList()
        val index = dishes.indexOfFirst { it.id == dish.id }
        if (index >= 0) {
            dishes[index] = dish
            saveAllDishes(dishes)
        }
    }

    private fun saveAllDishes(dishes: List<Dish>) {
        dishesFile.writeText(json.encodeToString(dishes))
    }

    private fun getDefaultDishes(): List<Dish> = listOf(
        Dish(name = "宫保鸡丁", price = 28f, category = "热菜"),
        Dish(name = "麻婆豆腐", price = 18f, category = "热菜"),
        Dish(name = "西红柿炒蛋", price = 15f, category = "热菜"),
        Dish(name = "酸辣土豆丝", price = 12f, category = "凉菜"),
        Dish(name = "拍黄瓜", price = 8f, category = "凉菜"),
        Dish(name = "米饭", price = 2f, category = "主食"),
        Dish(name = "可乐", price = 5f, category = "饮品")
    )
}