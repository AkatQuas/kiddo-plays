package com.example.catering.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.catering.data.model.Dish
import com.example.catering.ui.component.CommonTextField
import com.example.catering.ui.component.ConfirmDialog
import com.example.catering.ui.component.DishItemCard
import com.example.catering.viewmodel.DishViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DishManageScreen(
    viewModel: DishViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale.CHINA)

    var newDishName by remember { mutableStateOf("") }
    var newDishPrice by remember { mutableStateOf("") }
    var newDishCategory by remember { mutableStateOf("默认分类") }
    var editDishName by remember { mutableStateOf("") }
    var editDishPrice by remember { mutableStateOf("") }
    var editDishCategory by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("菜品管理") }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::showAddDialog) {
                Icon(Icons.Default.Add, contentDescription = "添加菜品")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.categories.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = uiState.selectedCategory == null,
                            onClick = { viewModel.setSelectedCategory(null) },
                            label = { Text("全部") }
                        )
                    }
                    items(uiState.categories) { category ->
                        FilterChip(
                            selected = uiState.selectedCategory == category,
                            onClick = { viewModel.setSelectedCategory(category) },
                            label = { Text(category) }
                        )
                    }
                }
            }

            Box(modifier = Modifier.fillMaxSize()) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                } else {
                    val filteredDishes = viewModel.getFilteredDishes()
                    if (filteredDishes.isEmpty()) {
                        Text(
                            text = "暂无菜品",
                            modifier = Modifier.align(Alignment.Center),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filteredDishes) { dish ->
                                DishManageCard(
                                    dish = dish,
                                    currencyFormat = currencyFormat,
                                    onEdit = {
                                        editDishName = dish.name
                                        editDishPrice = dish.price.toString()
                                        editDishCategory = dish.category
                                        viewModel.selectDish(dish)
                                        viewModel.showEditDialog(dish)
                                    },
                                    onDelete = {
                                        viewModel.selectDish(dish)
                                        viewModel.showDeleteDialog()
                                    },
                                    onToggleStock = { viewModel.toggleDishStock(dish) }
                                )
                            }
                        }
                    }
                }
            }
        }

        if (uiState.showAddDialog) {
            var expanded by remember { mutableStateOf(false) }
            val categories = listOf("热菜", "凉菜", "主食", "饮品", "小吃", "默认分类")

            AlertDialog(
                onDismissRequest = viewModel::hideAddDialog,
                title = { Text("新增菜品") },
                text = {
                    Column {
                        CommonTextField(
                            value = newDishName,
                            onValueChange = { newDishName = it },
                            label = "菜品名称"
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        CommonTextField(
                            value = newDishPrice,
                            onValueChange = { newDishPrice = it },
                            label = "价格",
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        ExposedDropdownMenuBox(
                            expanded = expanded,
                            onExpandedChange = { expanded = !expanded }
                        ) {
                            OutlinedTextField(
                                value = newDishCategory,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("分类") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false }
                            ) {
                                categories.forEach { category ->
                                    DropdownMenuItem(
                                        text = { Text(category) },
                                        onClick = {
                                            newDishCategory = category
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val price = newDishPrice.toFloatOrNull() ?: 0f
                            if (newDishName.isNotBlank() && price > 0) {
                                viewModel.addDish(newDishName, price, newDishCategory)
                                newDishName = ""
                                newDishPrice = ""
                                newDishCategory = "默认分类"
                            }
                        }
                    ) {
                        Text("添加")
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::hideAddDialog) {
                        Text("取消")
                    }
                }
            )
        }

        if (uiState.showEditDialog && uiState.selectedDish != null) {
            var expanded by remember { mutableStateOf(false) }
            val categories = listOf("热菜", "凉菜", "主食", "饮品", "小吃", "默认分类")

            AlertDialog(
                onDismissRequest = viewModel::hideEditDialog,
                title = { Text("编辑菜品") },
                text = {
                    Column {
                        CommonTextField(
                            value = editDishName,
                            onValueChange = { editDishName = it },
                            label = "菜品名称"
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        CommonTextField(
                            value = editDishPrice,
                            onValueChange = { editDishPrice = it },
                            label = "价格",
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        ExposedDropdownMenuBox(
                            expanded = expanded,
                            onExpandedChange = { expanded = !expanded }
                        ) {
                            OutlinedTextField(
                                value = editDishCategory,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("分类") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false }
                            ) {
                                categories.forEach { category ->
                                    DropdownMenuItem(
                                        text = { Text(category) },
                                        onClick = {
                                            editDishCategory = category
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            val price = editDishPrice.toFloatOrNull() ?: 0f
                            if (editDishName.isNotBlank() && price > 0) {
                                viewModel.updateDish(
                                    uiState.selectedDish!!.copy(
                                        name = editDishName,
                                        price = price,
                                        category = editDishCategory
                                    )
                                )
                            }
                        }
                    ) {
                        Text("保存")
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::hideEditDialog) {
                        Text("取消")
                    }
                }
            )
        }

        if (uiState.showDeleteDialog) {
            ConfirmDialog(
                title = "删除菜品",
                message = "确定要删除这个菜品吗？",
                confirmText = "删除",
                onConfirm = viewModel::deleteDish,
                onDismiss = viewModel::hideDeleteDialog
            )
        }
    }
}

@Composable
private fun DishManageCard(
    dish: Dish,
    currencyFormat: NumberFormat,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleStock: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (dish.inStock) {
                MaterialTheme.colorScheme.surface
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = dish.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${dish.category} | ${currencyFormat.format(dish.price)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (!dish.inStock) {
                    Text(
                        text = "已下架",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(
                    checked = dish.inStock,
                    onCheckedChange = { onToggleStock() }
                )
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = "编辑")
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "删除",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}