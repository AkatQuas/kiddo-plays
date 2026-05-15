# 餐饮小店订单管理系统｜Kotlin 安卓应用开发文档

**适配配置**：基于你的 `libs.versions.toml` 版本管理 | Gradle 9.4.1-bin | AGP 9.2.1 | Kotlin 2.2.10 | 最低兼容安卓 9.0 (API 28)
**UI框架**：纯 Jetpack Compose (Material 3) | 架构：MVVM
**文档说明**：完全同步你的依赖版本，移除无关第三方库，保留核心业务逻辑，纯原生 Compose 实现
**文档版本**：V1.0.1（补充版）

---

# 一、文档总则

## 1.1 开发背景

本项目为纯本地化离线餐饮订单管理 Android APP，基于 **Kotlin + Jetpack Compose** 原生开发，无跨端、无联网、无云端存储，适配安卓 9.0 及以上机型，满足餐饮门店接单、订单管理、数据统计核心需求。

## 1.2 核心配置与技术栈（100% 匹配 libs.versions.toml）

### 核心构建版本

| 配置项                | 版本号       |
| --------------------- | ------------ |
| Android Gradle Plugin | 9.2.1        |
| Kotlin                | 2.2.10       |
| Gradle                | 9.4.1-bin    |
| 最低安卓版本          | 9.0 (API 28) |
| 目标安卓版本          | 35           |
| 编译安卓版本          | 35           |

### 依赖库版本（严格对齐 toml 文件）

| 依赖分类         | 库名称                              | 版本号     |
| ---------------- | ----------------------------------- | ---------- |
| 核心扩展         | androidx-core-ktx                   | 1.10.1     |
| 生命周期组件     | androidx-lifecycle-runtime-ktx      | 2.6.1      |
| Compose 载体     | androidx-activity-compose           | 1.8.0      |
| Compose 版本管理 | compose-bom                         | 2025.12.00 |
| UI 组件库        | androidx-compose-material3          | BOM 管理   |
| 自适应导航       | material3-adaptive-navigation-suite | BOM 管理   |
| Kotlin 序列化    | kotlinx-serialization-json          | 1.6.3      |

### 测试依赖（内置）

- junit:4.13.2
- androidx-test-ext-junit:1.1.5
- espresso-core:3.5.1

## 1.3 架构设计原则

1. **纯 Compose 原生**：无 XML 布局、无 Fragment，全页面使用 Jetpack Compose 实现
2. **版本统一**：所有依赖通过 `libs.versions.toml` 集中管理，无硬编码版本
3. **兼容性**：仅使用 API 28+ 兼容 API，适配安卓 9.0 全机型
4. **离线优先**：纯本地运行，无网络请求
5. **MVVM 解耦**：Compose UI + ViewModel + 状态驱动，无业务耦合
6. **单一职责**：每个类/函数只负责一项功能，代码可维护性优先

---

# 二、整体技术架构（Compose MVVM）

## 2.1 架构分层

**UI 层 (Compose Screen)** → **ViewModel 层** → **Repository 层** → **数据存储层** → **原生能力层**
单向数据流，状态由 ViewModel 统一管理，Compose 自动响应状态变化

## 2.2 分层职责

### 2.2.1 UI 层（Jetpack Compose）

- 无 XML、无 Activity/Fragment 混合开发，全量 Compose 函数
- 基于 Material 3 + 自适应导航套件构建页面
- 仅负责 UI 渲染、用户交互点击事件转发，无任何业务逻辑
- 核心组件：Scaffold、LazyColumn、NavigationBar、AlertDialog、OutlinedTextField
- 状态收集：统一使用 `collectAsStateWithLifecycle()` 收集 Flow 状态

### 2.2.2 ViewModel 层

- 继承 `ViewModel`，生命周期感知
- 管理页面状态、业务逻辑、数据处理
- 调用 Repository 层进行数据操作
- 配合 Lifecycle KTX 实现生命周期安全
- 状态管理：使用 `mutableStateOf` 管理本地 UI 状态，`MutableStateFlow` 管理共享状态

### 2.2.3 Repository 层

- 数据访问抽象层，隔离 ViewModel 与具体存储实现
- 定义统一的数据操作接口
- 处理数据序列化与反序列化
- 保证数据操作的原子性

### 2.2.4 数据存储层

- 本地数据存储（SharedPreferences + 应用私有文件存储）
- 适配安卓 9.0 存储规范，无第三方数据库依赖
- 使用 Kotlin 内置序列化进行数据持久化

### 2.2.5 原生能力层

- 调用安卓原生 API（语音、文件、权限）
- 封装工具类，适配 API 28+ 兼容
- 提供统一的原生能力调用接口

## 2.3 工程目录结构规范

```
com.example.catering/
├── App.kt                     // 应用入口（Compose 根组件）
├── MainActivity.kt            // 唯一的 Activity 入口
├── ui/                        // Compose UI层
│   ├── screen/                // 页面级Compose函数
│   │   ├── InitScreen.kt      // 初始化页面
│   │   ├── HomeScreen.kt      // 首页（接单页）
│   │   ├── OrderListScreen.kt // 订单列表页
│   │   ├── StatisticsScreen.kt// 数据统计页
│   │   ├── DishManageScreen.kt// 菜品管理页
│   │   └── SettingsScreen.kt  // 设置页
│   ├── component/             // 通用可复用组件
│   │   ├── CommonTextField.kt // 通用输入框
│   │   ├── OrderItemCard.kt   // 订单卡片组件
│   │   ├── DishItemCard.kt    // 菜品卡片组件
│   │   └── ConfirmDialog.kt   // 通用确认弹窗
│   └── navigation/            // 导航配置
│       ├── AppNavigation.kt   // 导航路由定义
│       └── NavDestinations.kt // 路由常量
├── viewmodel/                 // ViewModel层
│   ├── HomeViewModel.kt
│   ├── OrderViewModel.kt
│   ├── StatisticsViewModel.kt
│   ├── DishViewModel.kt
│   └── SettingsViewModel.kt
├── data/                      // 数据层
│   ├── model/                 // 数据实体类
│   │   ├── Order.kt
│   │   ├── OrderItem.kt
│   │   ├── Dish.kt
│   │   └── ShopConfig.kt
│   └── repository/            // 数据仓库
│       ├── OrderRepository.kt
│       ├── DishRepository.kt
│       └── ShopRepository.kt
└── utils/                     // 工具类
    ├── TtsUtil.kt             // 语音播报工具
    ├── PermissionUtil.kt      // 权限管理工具
    ├── StorageUtil.kt         // 文件存储工具
    └── TimeUtil.kt            // 时间格式化工具
```

---

# 三、构建配置（核心：Gradle 9.4.1 + AGP 9.2.1）

## 3.1 模块级 build.gradle.kts 配置（关键）

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.example.catering"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.catering"
        minSdk = 28 // 安卓9.0
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    buildFeatures {
        compose = true // 启用Compose
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // 核心依赖（来自libs.versions.toml）
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.serialization.json)

    // Compose Bill of Materials
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)

    // 测试依赖
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
```

## 3.2 版本管理规范

所有依赖版本**仅在 `libs.versions.toml` 中修改**，代码中无版本硬编码，符合 Android 官方最佳实践。

---

# 四、页面设计（纯 Compose 实现）

基于 **Material 3 + 自适应导航套件**，共 6 个核心页面，无冗余组件

## 4.1 核心页面清单

1. **初始化页面**：店铺基础配置（首次启动）
2. **首页（接单页）**：订单快捷操作、菜品点单
3. **订单列表页**：当日订单管理、状态筛选
4. **数据统计页**：营收、订单量统计
5. **菜品管理页**：菜品增删改查
6. **设置页**：店铺配置、数据管理

## 4.2 页面交互规范（Compose 专属）

- 列表使用 `LazyColumn` 实现高性能滚动
- 底部导航使用 `Material 3 NavigationBar`
- 弹窗使用 Compose 原生 `AlertDialog`
- 表单使用 `Material 3 OutlinedTextField`
- 状态刷新：Compose 自动响应 State 变化，无需手动刷新 UI
- 加载状态：使用 `CircularProgressIndicator` 显示加载中
- 空状态：显示友好的空数据提示文本

## 4.3 导航与交互流程

### 4.3.1 导航结构

- **初始化页**：仅首次启动显示，完成店铺配置后跳转到首页，后续启动直接进入首页
- **底部导航栏**：包含5个菜单项（首页、订单列表、数据统计、菜品管理、设置）
- **路由定义**：使用 Compose Navigation 定义路由常量
  ```kotlin
  object NavDestinations {
      const val INIT = "init"
      const val HOME = "home"
      const val ORDER_LIST = "order_list"
      const val STATISTICS = "statistics"
      const val DISH_MANAGE = "dish_manage"
      const val SETTINGS = "settings"
  }
  ```
- **导航跳转**：使用 `NavController.navigate()` 进行页面跳转，避免使用 `popUpTo` 导致的状态丢失

### 4.3.2 核心业务交互流程

1. **订单创建流程**
   - 首页 → 点击菜品卡片选择（支持多选+数量调整）
   - 已选菜品显示在底部结算栏，显示总金额
   - 点击"创建订单" → 弹出备注输入框（可选）
   - 确认创建 → 保存到本地存储 → 语音播报"新订单创建成功，金额XX元"
   - 自动跳转到订单列表页，显示最新订单

2. **订单状态修改流程**
   - 订单列表页 → 点击订单卡片进入详情
   - 点击"修改状态"按钮 → 弹出状态选择弹窗（未支付/已支付/已完成）
   - 选择状态 → 确认后更新存储 + UI 自动刷新
   - 状态变更为"已完成"时，语音播报"订单已完成"

3. **菜品管理流程**
   - 菜品管理页 → 点击"+"按钮 → 弹出新增菜品弹窗
   - 输入菜品名称、价格、选择分类 → 保存
   - 点击菜品卡片 → 弹出编辑弹窗，可修改信息或删除
   - 删除菜品时需二次确认，防止误操作

4. **数据统计流程**
   - 进入数据统计页 → ViewModel 自动计算当日数据
   - 显示当日订单总数、总营收、平均客单价
   - 按订单状态分类统计数量

---

# 五、核心功能实现（适配 API 28 / 无第三方依赖）

## 5.1 数据模型与存储实现

### 5.1.1 核心实体类定义

使用 Kotlin 内置序列化 `@Serializable` 注解，支持 JSON 序列化与反序列化

```kotlin
// 订单状态枚举
enum class OrderStatus {
    UNPAID, // 未支付
    PAID,   // 已支付
    COMPLETED // 已完成
}

// 订单项实体
@Serializable
data class OrderItem(
    val dishId: String,
    val dishName: String,
    val price: Float,
    val quantity: Int = 1
)

// 订单实体
@Serializable
data class Order(
    val id: String = UUID.randomUUID().toString(),
    val items: List<OrderItem> = emptyList(),
    val amount: Float = 0f,
    val status: OrderStatus = OrderStatus.UNPAID,
    val remark: String = "",
    val createTime: Long = System.currentTimeMillis()
)

// 菜品实体
@Serializable
data class Dish(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val price: Float,
    val category: String = "默认分类",
    val inStock: Boolean = true
)

// 店铺配置实体
@Serializable
data class ShopConfig(
    val shopName: String = "我的小店",
    val businessHours: String = "09:00-22:00",
    val isFirstLaunch: Boolean = true
)
```

### 5.1.2 存储实现规范

- **存储方式**：
  - 店铺配置：使用 SharedPreferences（键名：`sp_shop_config`）
  - 订单数据：使用应用私有目录文件存储（路径：`context.filesDir/orders.json`）
  - 菜品数据：使用应用私有目录文件存储（路径：`context.filesDir/dishes.json`）
- **序列化**：使用 `kotlinx.serialization.json.Json` 进行 JSON 序列化
- **数据操作**：所有数据操作在后台线程执行，避免阻塞主线程
- **Repository 接口示例**：
  ```kotlin
  interface OrderRepository {
      suspend fun saveOrder(order: Order)
      suspend fun getOrderById(id: String): Order?
      suspend fun getAllOrders(): List<Order>
      suspend fun getOrdersByStatus(status: OrderStatus): List<Order>
      suspend fun updateOrderStatus(id: String, status: OrderStatus)
      suspend fun deleteOrder(id: String)
  }
  ```

## 5.2 订单管理

- 订单创建：自动生成 UUID 作为订单 ID，计算总金额，记录创建时间
- 订单状态修改：支持未支付→已支付→已完成的单向流转
- 订单列表：按创建时间倒序排列，支持按状态筛选
- 订单详情：显示所有订单项、总金额、状态、备注、创建时间
- 本地存储：每次数据变更立即持久化到文件

## 5.3 菜品管理

- 菜品新增：支持输入名称、价格、分类，默认库存充足
- 菜品编辑：可修改所有字段信息
- 菜品删除：删除后关联的历史订单不受影响
- 菜品筛选：支持按分类筛选菜品
- 库存管理：支持标记菜品是否在售

## 5.4 数据统计

- 当日订单数：统计当日创建的所有订单数量（含所有状态）
- 当日营收：统计当日状态为 PAID/COMPLETED 的订单金额总和
- 平均客单价：当日营收 ÷ 当日已支付订单数
- 状态分布：统计当日各状态订单的数量
- 纯 Kotlin 逻辑实现，无图表库依赖，使用文本和简单进度条展示

## 5.5 ViewModel 状态管理规范

### 5.5.1 页面状态定义

每个页面定义独立的 UI State 数据类，包含页面所有状态信息

```kotlin
// 首页UI状态
data class HomeUiState(
    val isLoading: Boolean = false,
    val dishes: List<Dish> = emptyList(),
    val selectedItems: List<OrderItem> = emptyList(),
    val totalAmount: Float = 0f,
    val showRemarkDialog: Boolean = false,
    val errorMessage: String? = null
)

// 订单列表UI状态
data class OrderListUiState(
    val isLoading: Boolean = false,
    val orders: List<Order> = emptyList(),
    val filterStatus: OrderStatus? = null,
    val selectedOrder: Order? = null,
    val showStatusDialog: Boolean = false
)
```

### 5.5.2 状态管理实现

- 使用 `MutableStateFlow` 管理页面状态
- ViewModel 初始化时加载数据
- 所有状态变更通过 `update` 方法统一处理
- 示例：

  ```kotlin
  class HomeViewModel(
      private val dishRepository: DishRepository,
      private val orderRepository: OrderRepository
  ) : ViewModel() {
      private val _uiState = MutableStateFlow(HomeUiState())
      val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

      init {
          loadDishes()
      }

      private fun loadDishes() = viewModelScope.launch {
          _uiState.update { it.copy(isLoading = true) }
          try {
              val dishes = dishRepository.getAllDishes()
              _uiState.update { it.copy(isLoading = false, dishes = dishes) }
          } catch (e: Exception) {
              _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
          }
      }
  }
  ```

## 5.6 原生能力适配（API 28 兼容）

### 5.6.1 权限管理

- **所需权限**：仅申请 `WRITE_EXTERNAL_STORAGE`（API 28 必需）
- **申请时机**：首次启动应用时动态申请
- **实现方式**：使用 `ActivityResultContracts.RequestPermission`
- **权限拒绝处理**：提示用户权限是应用正常运行必需的

### 5.6.2 TTS 语音播报

- **触发时机**：新订单创建、订单状态变更为已完成
- **实现方式**：调用安卓原生 `TextToSpeech` API
- **工具类封装**：

  ```kotlin
  class TtsUtil(private val context: Context) {
      private var tts: TextToSpeech? = null

      fun init() {
          tts = TextToSpeech(context) { status ->
              if (status == TextToSpeech.SUCCESS) {
                  tts?.language = Locale.CHINA
              }
          }
      }

      fun speak(text: String) {
          tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
      }

      fun destroy() {
          tts?.stop()
          tts?.shutdown()
      }
  }
  ```

- **生命周期管理**：在 MainActivity 的 `onCreate` 中初始化，`onDestroy` 中销毁

### 5.6.3 文件存储

- 仅使用应用私有目录（`context.filesDir`），无需申请外部存储权限（API 29+）
- 适配 API 28 存储规则，确保在安卓 9.0 上正常运行
- 文件操作使用 `kotlinx.coroutines.Dispatchers.IO` 线程

---

# 六、兼容性与性能优化（安卓 9.0 专属）

## 6.1 兼容性保障

- 最低 API 28，放弃低版本适配
- 不使用 Android 10+ 专属 API，保证安卓 9.0 稳定运行
- Compose 兼容层自动适配不同屏幕尺寸和分辨率
- 测试覆盖主流安卓 9.0 机型（小米、华为、OPPO、VIVO）

## 6.2 性能优化

- Compose 重组优化：使用 `remember`、`mutableStateOf` 减少无效重组
- 列表使用 `LazyColumn` 实现视图复用，避免卡顿
- 无大图、无复杂动画，适配低端机型
- 数据操作在后台线程执行，不阻塞主线程
- 避免在 Compose 函数中创建对象，减少垃圾回收
- 使用 `by viewModels()` 管理 ViewModel 生命周期

---

# 七、版本迭代与规范

## 7.1 V1.0 基础版（当前版本）

- 完成 Compose MVVM 架构搭建
- 实现核心 6 个页面
- 订单/菜品/统计基础功能
- 适配 Gradle 9.4.1 + AGP 9.2.1 + API 28
- 全量依赖通过 `libs.versions.toml` 管理
- 纯本地离线运行，无网络请求

## 7.2 扩展规范

- 新增依赖必须添加到 `libs.versions.toml`
- 保持纯 Compose 开发，不引入 XML 布局
- 业务逻辑全部放在 ViewModel，不耦合 UI
- 新增功能必须遵循现有架构分层
- 代码提交前必须通过编译和基本功能测试

---

# 八、开发约束与注意事项

1. **禁止引入任何第三方库**：除文档中明确列出的官方依赖外，不得使用任何第三方库
2. **严格遵循 API 28 兼容**：不得使用 API 29+ 的任何新特性
3. **纯离线运行**：不得添加任何网络请求代码
4. **数据安全**：所有数据仅存储在应用私有目录，不得泄露用户数据
5. **代码规范**：遵循 Kotlin 官方编码规范，使用有意义的变量名和函数名
6. **错误处理**：所有可能抛出异常的操作必须进行异常处理，避免应用崩溃

---

# 九、总结（核心适配点）

1. **版本完全对齐**：AGP 9.2.1、Kotlin 2.2.10、Compose BOM 2025.12.00 等严格匹配你的 toml 文件
2. **纯 Compose 开发**：无 Fragment/XML，符合现代 Android 开发规范
3. **最低兼容**：安卓 9.0 (API 28)，构建工具 Gradle 9.4.1-bin
4. **无冗余依赖**：仅使用官方依赖，移除所有第三方库
5. **工程规范**：官方推荐的 TOML 版本管理 + Compose MVVM 架构
6. **可执行性强**：包含完整的数据模型、存储实现、状态管理和交互流程

---

## 交付说明

Claude 将基于此文档输出：

- 符合 Gradle 9.4.1 + AGP 9.2.1 版本的可编译工程
- 适配安卓 9.0（API 28）的纯 Compose 原生代码
- 实现订单/菜品/统计核心功能的离线运行 APP
- 遵循 MVVM 架构、代码结构规范、注释清晰的完整项目
