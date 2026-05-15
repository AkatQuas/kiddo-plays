package com.example.catering.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.catering.data.model.Dish
import com.example.catering.data.model.Order
import com.example.catering.data.model.OrderItem
import com.example.catering.data.repository.DishRepository
import com.example.catering.data.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = false,
    val dishes: List<Dish> = emptyList(),
    val selectedItems: List<OrderItem> = emptyList(),
    val totalAmount: Float = 0f,
    val showRemarkDialog: Boolean = false,
    val remark: String = "",
    val errorMessage: String? = null,
    val orderCreated: Boolean = false
)

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val dishRepository = DishRepository(application)
    private val orderRepository = OrderRepository(application)

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadDishes()
    }

    private fun loadDishes() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val dishes = dishRepository.getAllDishes()
                _uiState.update { it.copy(isLoading = false, dishes = dishes) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun selectDish(dish: Dish) {
        val currentItems = _uiState.value.selectedItems.toMutableList()
        val existingIndex = currentItems.indexOfFirst { it.dishId == dish.id }

        if (existingIndex >= 0) {
            val existing = currentItems[existingIndex]
            currentItems[existingIndex] = existing.copy(quantity = existing.quantity + 1)
        } else {
            currentItems.add(OrderItem(dish.id, dish.name, dish.price, 1))
        }

        val totalAmount = currentItems.sumOf { (it.price * it.quantity).toDouble() }.toFloat()
        _uiState.update { it.copy(selectedItems = currentItems, totalAmount = totalAmount) }
    }

    fun deselectDish(dishId: String) {
        val currentItems = _uiState.value.selectedItems.toMutableList()
        val existingIndex = currentItems.indexOfFirst { it.dishId == dishId }

        if (existingIndex >= 0) {
            val existing = currentItems[existingIndex]
            if (existing.quantity > 1) {
                currentItems[existingIndex] = existing.copy(quantity = existing.quantity - 1)
            } else {
                currentItems.removeAt(existingIndex)
            }
        }

        val totalAmount = currentItems.sumOf { (it.price * it.quantity).toDouble() }.toFloat()
        _uiState.update { it.copy(selectedItems = currentItems, totalAmount = totalAmount) }
    }

    fun getSelectedQuantity(dishId: String): Int {
        return _uiState.value.selectedItems.find { it.dishId == dishId }?.quantity ?: 0
    }

    fun showRemarkDialog() {
        _uiState.update { it.copy(showRemarkDialog = true) }
    }

    fun hideRemarkDialog() {
        _uiState.update { it.copy(showRemarkDialog = false, remark = "") }
    }

    fun updateRemark(remark: String) {
        _uiState.update { it.copy(remark = remark) }
    }

    fun createOrder(onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            val state = _uiState.value
            if (state.selectedItems.isEmpty()) return@launch

            val order = Order(
                items = state.selectedItems,
                amount = state.totalAmount,
                remark = state.remark
            )

            orderRepository.saveOrder(order)
            _uiState.update {
                it.copy(
                    selectedItems = emptyList(),
                    totalAmount = 0f,
                    showRemarkDialog = false,
                    remark = "",
                    orderCreated = true
                )
            }
            onSuccess("新订单创建成功，金额${state.totalAmount}元")
        }
    }

    fun clearOrderCreated() {
        _uiState.update { it.copy(orderCreated = false) }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedItems = emptyList(), totalAmount = 0f) }
    }
}