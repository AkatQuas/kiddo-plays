package com.example.catering.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.catering.data.model.Dish
import com.example.catering.data.repository.DishRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DishManageUiState(
    val isLoading: Boolean = false,
    val dishes: List<Dish> = emptyList(),
    val categories: List<String> = emptyList(),
    val selectedCategory: String? = null,
    val selectedDish: Dish? = null,
    val showAddDialog: Boolean = false,
    val showEditDialog: Boolean = false,
    val showDeleteDialog: Boolean = false,
    val errorMessage: String? = null
)

class DishViewModel(application: Application) : AndroidViewModel(application) {

    private val dishRepository = DishRepository(application)

    private val _uiState = MutableStateFlow(DishManageUiState())
    val uiState: StateFlow<DishManageUiState> = _uiState.asStateFlow()

    init {
        loadDishes()
    }

    fun loadDishes() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val dishes = dishRepository.getAllDishes()
                val categories = dishes.map { it.category }.distinct()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        dishes = dishes,
                        categories = categories
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun setSelectedCategory(category: String?) {
        _uiState.update { it.copy(selectedCategory = category) }
    }

    fun getFilteredDishes(): List<Dish> {
        val category = _uiState.value.selectedCategory
        return if (category == null) {
            _uiState.value.dishes
        } else {
            _uiState.value.dishes.filter { it.category == category }
        }
    }

    fun selectDish(dish: Dish) {
        _uiState.update { it.copy(selectedDish = dish) }
    }

    fun clearSelectedDish() {
        _uiState.update { it.copy(selectedDish = null) }
    }

    fun showAddDialog() {
        _uiState.update { it.copy(showAddDialog = true) }
    }

    fun hideAddDialog() {
        _uiState.update { it.copy(showAddDialog = false) }
    }

    fun showEditDialog(dish: Dish) {
        _uiState.update { it.copy(selectedDish = dish, showEditDialog = true) }
    }

    fun hideEditDialog() {
        _uiState.update { it.copy(showEditDialog = false) }
    }

    fun showDeleteDialog() {
        _uiState.update { it.copy(showDeleteDialog = true) }
    }

    fun hideDeleteDialog() {
        _uiState.update { it.copy(showDeleteDialog = false) }
    }

    fun addDish(name: String, price: Float, category: String) {
        viewModelScope.launch {
            val dish = Dish(name = name, price = price, category = category)
            dishRepository.saveDish(dish)
            _uiState.update { it.copy(showAddDialog = false) }
            loadDishes()
        }
    }

    fun updateDish(dish: Dish) {
        viewModelScope.launch {
            dishRepository.updateDish(dish)
            _uiState.update { it.copy(showEditDialog = false, selectedDish = null) }
            loadDishes()
        }
    }

    fun deleteDish() {
        viewModelScope.launch {
            val dish = _uiState.value.selectedDish ?: return@launch
            dishRepository.deleteDish(dish.id)
            _uiState.update { it.copy(showDeleteDialog = false, selectedDish = null) }
            loadDishes()
        }
    }

    fun toggleDishStock(dish: Dish) {
        viewModelScope.launch {
            dishRepository.updateDish(dish.copy(inStock = !dish.inStock))
            loadDishes()
        }
    }
}