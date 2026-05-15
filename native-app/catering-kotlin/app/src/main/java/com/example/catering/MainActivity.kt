package com.example.catering

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.catering.ui.navigation.NavDestinations
import com.example.catering.ui.screen.DishManageScreen
import com.example.catering.ui.screen.HomeScreen
import com.example.catering.ui.screen.InitScreen
import com.example.catering.ui.screen.OrderListScreen
import com.example.catering.ui.screen.SettingsScreen
import com.example.catering.ui.screen.StatisticsScreen
import com.example.catering.ui.theme.CateringTheme
import com.example.catering.utils.TtsUtil
import com.example.catering.viewmodel.InitViewModel
import androidx.compose.foundation.layout.Box

class MainActivity : ComponentActivity() {

    private lateinit var ttsUtil: TtsUtil

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        ttsUtil = TtsUtil(this)
        ttsUtil.init()

        setContent {
            CateringTheme {
                CateringApp(
                    onSpeak = { text -> ttsUtil.speak(text) }
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ttsUtil.destroy()
    }
}

enum class AppDestinations(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    HOME(NavDestinations.HOME, "首页", Icons.Default.Home),
    ORDER_LIST(NavDestinations.ORDER_LIST, "订单", Icons.AutoMirrored.Filled.List),
    STATISTICS(NavDestinations.STATISTICS, "统计", Icons.Default.Assessment),
    DISH_MANAGE(NavDestinations.DISH_MANAGE, "菜品", Icons.Default.Store),
    SETTINGS(NavDestinations.SETTINGS, "设置", Icons.Default.Settings)
}

@Composable
fun CateringApp(
    onSpeak: (String) -> Unit = {}
) {
    var currentDestination by rememberSaveable { mutableStateOf(AppDestinations.HOME) }
    var showInitScreen by remember { mutableStateOf(true) }
    var initComplete by remember { mutableStateOf(false) }

    val initViewModel: InitViewModel = viewModel()
    val initUiState by initViewModel.uiState.collectAsState()

    LaunchedEffect(initUiState.isComplete) {
        if (initUiState.isComplete) {
            showInitScreen = false
            initComplete = true
        }
    }

    if (showInitScreen && !initComplete) {
        InitScreen(
            onComplete = {
                showInitScreen = false
            },
            viewModel = initViewModel
        )
    } else {
        NavigationSuiteScaffold(
            navigationSuiteItems = {
                AppDestinations.entries.forEach { destination ->
                    item(
                        icon = {
                            Icon(
                                destination.icon,
                                contentDescription = destination.label
                            )
                        },
                        label = { Text(destination.label) },
                        selected = destination == currentDestination,
                        onClick = { currentDestination = destination }
                    )
                }
            }
        ) {
            when (currentDestination) {
                AppDestinations.HOME -> HomeScreen(
                    onOrderCreated = {
                        onSpeak("新订单创建成功")
                    }
                )
                AppDestinations.ORDER_LIST -> OrderListScreen()
                AppDestinations.STATISTICS -> StatisticsScreen()
                AppDestinations.DISH_MANAGE -> DishManageScreen()
                AppDestinations.SETTINGS -> SettingsScreen()
            }
        }
    }
}