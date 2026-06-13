export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar Decimal

  enum RoleName {
    ADMIN
    MANAGER
    STAFF
    CALL_CENTRE_AGENT
    CUSTOMER
  }

  enum UserStatus {
    ACTIVE
    SUSPENDED
    DELETED
  }

  enum CentreStatus {
    ACTIVE
    SUSPENDED
  }

  enum StockMovementType {
    IN
    OUT
    ADJUSTMENT
  }

  enum OrderStatus {
    PENDING
    STAFF_COMPLETED
    CUSTOMER_REJECTED
    COMPLETED
    CANCELLED
  }

  enum NotificationType {
    INFO
    WARNING
    TASK
    SYSTEM
  }

  enum DutyPriority {
    LOW
    MEDIUM
    HIGH
  }

  enum DutyStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }

  enum HandoverStatus {
    ACTIVE
    COMPLETED
    CANCELLED
  }

  type Role {
    id: ID!
    name: RoleName!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type User {
    id: ID!
    username: String
    email: String!
    phone: String
    fullName: String!
    status: UserStatus!
    lastLoginAt: DateTime
    profilePhoto: String
    address: String
    deletedAt: DateTime
    role: Role!
    serviceCentre: ServiceCentre
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Customer {
    id: ID!
    fullName: String!
    phone: String!
    email: String
    address: String
    customerType: String
    notes: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ServiceCentre {
    id: ID!
    centreName: String!
    locationName: String
    phone: String
    managerName: String
    status: CentreStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Service {
    id: ID!
    name: String!
    description: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Product {
    id: ID!
    name: String!
    description: String
    price: Decimal!
    currency: String!
    isActive: Boolean!
    imageUrl: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type OrderItem {
    id: ID!
    product: Product!
    quantity: Int!
    unitPrice: Decimal!
    lineTotal: Decimal!
    createdAt: DateTime!
  }

		  type Order {
		    id: ID!
		    customer: Customer!
		    serviceCentre: ServiceCentre
		    status: OrderStatus!
	    transferredAt: DateTime
	    transferredFromServiceCentre: ServiceCentre
	    transferredToServiceCentre: ServiceCentre
	    transferredByUser: User
	    staffCompletedAt: DateTime
	    customerAcknowledgedAt: DateTime
	    customerRejectedAt: DateTime
	    customerRejectionReason: String
		    staffResponseAt: DateTime
		    staffResponseMessage: String
		    staffMessageAt: DateTime
		    staffMessageText: String
		    customerMessageAt: DateTime
		    customerMessageText: String
		    items: [OrderItem!]!
		    totalAmount: Decimal!
		    currency: String!
		    createdAt: DateTime!
		    updatedAt: DateTime!
		  }

	  type Feedback {
	    id: ID!
	    customer: Customer!
	    order: Order
	    rating: Int!
	    comment: String
	    createdAt: DateTime!
	  }

  type Sale {
    id: ID!
    customer: Customer
    serviceCentre: ServiceCentre!
    service: Service
    serviceCustom: String
    cupsSold: Int!
    takeawayCupsUsed: Int!
    amount: Decimal!
    currency: String!
    staffUser: User
    happenedAt: DateTime!
    createdAt: DateTime!
  }

  type StockItem {
    id: ID!
    serviceCentre: ServiceCentre!
    name: String!
    unit: String!
    lowStockThreshold: Int!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    inTotal: Int!
    outTotal: Int!
    total: Int!
    balance: Int!
  }

  type StockMovement {
    id: ID!
    serviceCentre: ServiceCentre!
    stockItem: StockItem!
    type: StockMovementType!
    quantity: Int!
    note: String
    createdByUser: User
    happenedAt: DateTime!
    createdAt: DateTime!
  }

  type Notification {
    id: ID!
    title: String!
    message: String!
    type: NotificationType!
    isRead: Boolean!
    sender: User
    receiver: User
    serviceCentre: ServiceCentre
    targetRole: RoleName
    createdAt: DateTime!
  }

  type Duty {
    id: ID!
    title: String!
    description: String
    priority: DutyPriority!
    status: DutyStatus!
    startDate: DateTime
    dueDate: DateTime
    assignedToUser: User!
    assignedByUser: User!
    serviceCentre: ServiceCentre!
    comments: [DutyComment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DutyComment {
    id: ID!
    duty: Duty!
    user: User!
    message: String!
    createdAt: DateTime!
  }

  type HandoverPermission {
    id: ID!
    code: String!
  }

  type Handover {
    id: ID!
    manager: User!
    assignedStaff: User!
    serviceCentre: ServiceCentre!
    reason: String
    notes: String
    startDate: DateTime!
    endDate: DateTime!
    status: HandoverStatus!
    permissions: [HandoverPermission!]!
    createdAt: DateTime!
  }

  type ActivityLog {
    id: ID!
    user: User
    action: String!
    module: String!
    description: String!
    ipAddress: String
    createdAt: DateTime!
  }

  input PaginationInput {
    page: Int = 1
    pageSize: Int = 20
  }

  type PageInfo {
    page: Int!
    pageSize: Int!
    total: Int!
    hasNextPage: Boolean!
  }

  type CustomerPage {
    nodes: [Customer!]!
    pageInfo: PageInfo!
  }

  type ServiceCentrePage {
    nodes: [ServiceCentre!]!
    pageInfo: PageInfo!
  }

  type SalePage {
    nodes: [Sale!]!
    pageInfo: PageInfo!
  }

  type StockItemPage {
    nodes: [StockItem!]!
    pageInfo: PageInfo!
  }

  type StockMovementPage {
    nodes: [StockMovement!]!
    pageInfo: PageInfo!
  }

  type UserPage {
    nodes: [User!]!
    pageInfo: PageInfo!
  }

  type NotificationPage {
    nodes: [Notification!]!
    pageInfo: PageInfo!
  }

  type DutyPage {
    nodes: [Duty!]!
    pageInfo: PageInfo!
  }

  type HandoverPage {
    nodes: [Handover!]!
    pageInfo: PageInfo!
  }

  type ActivityLogPage {
    nodes: [ActivityLog!]!
    pageInfo: PageInfo!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type AuthTokens {
    accessToken: String!
    refreshToken: String!
  }

  type LoginPayload {
    tokens: AuthTokens!
    user: User!
  }

  input CreateCustomerInput {
    fullName: String!
    phone: String!
    email: String
    address: String
    customerType: String
    notes: String
  }

  input UpdateCustomerInput {
    fullName: String
    phone: String
    email: String
    address: String
    customerType: String
    notes: String
  }

  input CreateServiceCentreInput {
    centreName: String!
    locationName: String
    phone: String
    managerName: String
    status: CentreStatus
  }

  input UpdateServiceCentreInput {
    centreName: String
    locationName: String
    phone: String
    managerName: String
    status: CentreStatus
  }

  input CreateSaleInput {
    customerId: ID
    serviceCentreId: ID!
    serviceId: ID
    serviceCustom: String
    cupsSold: Int = 0
    takeawayCupsUsed: Int = 0
    amount: Decimal!
    currency: String = "TZS"
    happenedAt: DateTime
  }

  input CreateStockItemInput {
    serviceCentreId: ID!
    name: String!
    unit: String = "unit"
    lowStockThreshold: Int = 0
  }

  input UpdateStockItemInput {
    name: String
    unit: String
    lowStockThreshold: Int
    isActive: Boolean
  }

  input CreateStockMovementInput {
    serviceCentreId: ID!
    stockItemId: ID!
    type: StockMovementType!
    quantity: Int!
    note: String
    happenedAt: DateTime
  }

  input RegisterCustomerInput {
    email: String!
    username: String!
    phone: String!
    password: String!
  }

  input UpdateMyProfileInput {
    fullName: String
    phone: String
    address: String
    customerType: String
    notes: String
  }

  input UpdateMyAccountInput {
    fullName: String
    phone: String
    address: String
    profilePhoto: String
  }

  input CreateProductInput {
    name: String!
    description: String
    price: Decimal!
    currency: String = "TZS"
    imageUrl: String
  }

  input UpdateProductInput {
    name: String
    description: String
    price: Decimal
    currency: String
    isActive: Boolean
    imageUrl: String
  }

  input CreateOrderInput {
    productId: ID!
    quantity: Int = 1
    serviceCentreId: ID
  }

	  input UpdateMyOrderInput {
	    productId: ID
	    quantity: Int
	    serviceCentreId: ID
	  }

	  input CreateFeedbackInput {
	    orderId: ID
	    rating: Int!
	    comment: String
	  }

  type ProductPage {
    nodes: [Product!]!
    pageInfo: PageInfo!
  }

	  type OrderPage {
	    nodes: [Order!]!
	    pageInfo: PageInfo!
	  }

	  type FeedbackPage {
	    nodes: [Feedback!]!
	    pageInfo: PageInfo!
	  }

  input CreateUserInput {
    fullName: String!
    email: String!
    phone: String
    username: String
    password: String!
    role: RoleName!
    serviceCentreId: ID
    address: String
    profilePhoto: String
  }

  input UpdateUserInput {
    fullName: String
    email: String
    phone: String
    username: String
    password: String
    role: RoleName
    serviceCentreId: ID
    status: UserStatus
    address: String
    profilePhoto: String
  }

  input SendNotificationInput {
    title: String!
    message: String!
    type: NotificationType = INFO
    receiverId: ID
    serviceCentreId: ID
    targetRole: RoleName
    sendToAll: Boolean = false
  }

  input CreateDutyInput {
    title: String!
    description: String
    assignedToUserId: ID!
    priority: DutyPriority = MEDIUM
    startDate: DateTime
    dueDate: DateTime
  }

  input UpdateDutyInput {
    title: String
    description: String
    priority: DutyPriority
    status: DutyStatus
    startDate: DateTime
    dueDate: DateTime
  }

  input AddDutyCommentInput {
    dutyId: ID!
    message: String!
  }

  input CreateHandoverInput {
    assignedStaffId: ID!
    reason: String
    notes: String
    startDate: DateTime!
    endDate: DateTime!
    permissions: [String!]!
  }

  input SetHandoverStatusInput {
    id: ID!
    status: HandoverStatus!
  }

  input UpdateHandoverInput {
    id: ID!
    assignedStaffId: ID
    reason: String
    notes: String
    startDate: DateTime
    endDate: DateTime
    permissions: [String!]
  }

  type DashboardKpis {
    totalCustomers: Int!
    totalServiceCentres: Int!
    cupsSoldToday: Int!
    takeawayCupsToday: Int!
    salesToday: Decimal!
    lowStockItems: Int!
  }

  type Dashboard {
    kpis: DashboardKpis!
    recentSales: [Sale!]!
    lowStockItems: [StockItem!]!
  }

  type SalesPoint {
    date: String!
    amount: Decimal!
  }

  type SalesChart {
    points: [SalesPoint!]!
  }

  type SalesTotals {
    day: Decimal!
    week: Decimal!
    month: Decimal!
  }

  type UsersByRolePoint {
    role: RoleName!
    total: Int!
  }

  type UsersByCentrePoint {
    serviceCentre: ServiceCentre!
    total: Int!
  }

  type StockInOutReport {
    inTotal: Int!
    outTotal: Int!
    net: Int!
  }

  type ServiceCentreStockPoint {
    serviceCentre: ServiceCentre!
    stockItems: Int!
    lowStockItems: Int!
    totalBalance: Int!
  }

  type StockBalanceItem {
    id: ID!
    name: String!
    unit: String!
    lowStockThreshold: Int!
    balance: Int!
  }

  type TopCustomerPoint {
    customer: Customer!
    visits: Int!
  }

  type UserReport {
    totalUsers: Int!
    activeUsers: Int!
    suspendedUsers: Int!
    deletedUsers: Int!
    usersByRole: [UsersByRolePoint!]!
    usersByServiceCentre: [UsersByCentrePoint!]!
  }

  type OrderStatusPoint {
    status: OrderStatus!
    total: Int!
  }

  type OrderStatusReport {
    total: Int!
    byStatus: [OrderStatusPoint!]!
  }

  input ReportRangeInput {
    from: DateTime
    to: DateTime
    preset: String
  }

  type Query {
    health: String!
    me: User
    myDelegatedPermissions: [String!]!
    appBranding: AppBranding!
    appVersion: AppVersion!

    customers(pagination: PaginationInput, search: String): CustomerPage!
    customer(id: ID!): Customer

    serviceCentres(pagination: PaginationInput, search: String, status: CentreStatus): ServiceCentrePage!
    serviceCentre(id: ID!): ServiceCentre

    services: [Service!]!

    products(pagination: PaginationInput, search: String, onlyActive: Boolean = true): ProductPage!
    product(id: ID!): Product

	    myCustomerProfile: Customer
	    myOrders(pagination: PaginationInput, status: OrderStatus): OrderPage!
	    myFeedback(pagination: PaginationInput): FeedbackPage!
	    orders(pagination: PaginationInput, status: OrderStatus, serviceCentreId: ID): OrderPage!

    sales(pagination: PaginationInput, serviceCentreId: ID, customerId: ID, from: DateTime, to: DateTime): SalePage!
    salesTotals(serviceCentreId: ID): SalesTotals!
    salesChart(serviceCentreId: ID, rangeDays: Int = 30): SalesChart!

    stockItems(pagination: PaginationInput, serviceCentreId: ID!, search: String): StockItemPage!
    stockMovements(pagination: PaginationInput, serviceCentreId: ID!, stockItemId: ID, from: DateTime, to: DateTime): StockMovementPage!

    dashboard(serviceCentreId: ID): Dashboard!

    users(pagination: PaginationInput, search: String, role: RoleName, status: UserStatus, serviceCentreId: ID): UserPage!
    user(id: ID!): User

    notifications(pagination: PaginationInput, onlyUnread: Boolean = false, isRead: Boolean): NotificationPage!
    unreadNotificationCount: Int!
    directMessages(pagination: PaginationInput, withUserId: ID!): NotificationPage!

    duties(pagination: PaginationInput, serviceCentreId: ID, status: DutyStatus): DutyPage!
    myDuties(pagination: PaginationInput, status: DutyStatus): DutyPage!
    userDuties(pagination: PaginationInput, userId: ID!, status: DutyStatus): DutyPage!

    handovers(pagination: PaginationInput, status: HandoverStatus, serviceCentreId: ID): HandoverPage!

    activityLogs(pagination: PaginationInput, module: String, userId: ID): ActivityLogPage!

    userReport(range: ReportRangeInput, serviceCentreId: ID): UserReport!
    orderStatusReport(range: ReportRangeInput, serviceCentreId: ID): OrderStatusReport!
    stockInOutReport(range: ReportRangeInput, serviceCentreId: ID): StockInOutReport!
    serviceCentreStocksReport: [ServiceCentreStockPoint!]!
    stockBalances(serviceCentreId: ID!): [StockBalanceItem!]!
    topCustomers(range: ReportRangeInput, serviceCentreId: ID, limit: Int = 10): [TopCustomerPoint!]!
  }

  type AppBranding {
    logoUrl: String
  }

  type AppVersion {
    latestVersion: String!
    latestBuildNumber: Int!
    minSupportedBuildNumber: Int!
    updateRequired: Boolean!
    downloadUrl: String!
    releaseNotes: String
  }

  input AppVersionInput {
    latestVersion: String!
    latestBuildNumber: Int!
    minSupportedBuildNumber: Int!
    updateRequired: Boolean!
    downloadUrl: String!
    releaseNotes: String
  }

  type Mutation {
    login(input: LoginInput!): LoginPayload!
    refresh(refreshToken: String!): AuthTokens!

    requestCustomerPasswordReset(email: String!): Boolean!
    resetCustomerPassword(email: String!, newPassword: String!): Boolean!
    resetUserPassword(userId: ID!, newPassword: String!): Boolean!

    registerCustomer(input: RegisterCustomerInput!): LoginPayload!
    updateMyProfile(input: UpdateMyProfileInput!): Customer!
    updateMyAccount(input: UpdateMyAccountInput!): User!

    setAppBranding(logoUrl: String): AppBranding!
    setAppVersion(input: AppVersionInput!): AppVersion!

    createCustomer(input: CreateCustomerInput!): Customer!
    updateCustomer(id: ID!, input: UpdateCustomerInput!): Customer!
    deleteCustomer(id: ID!): Boolean!

    createServiceCentre(input: CreateServiceCentreInput!): ServiceCentre!
    updateServiceCentre(id: ID!, input: UpdateServiceCentreInput!): ServiceCentre!
    setServiceCentreStatus(id: ID!, status: CentreStatus!): ServiceCentre!

    createSale(input: CreateSaleInput!): Sale!

    createStockItem(input: CreateStockItemInput!): StockItem!
    updateStockItem(id: ID!, input: UpdateStockItemInput!): StockItem!
    createStockMovement(input: CreateStockMovementInput!): StockMovement!
    deleteStockItem(id: ID!): StockItem!

    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Product!

    createOrder(input: CreateOrderInput!): Order!
    staffCompleteOrder(orderId: ID!): Order!
    acknowledgeOrder(orderId: ID!): Order!
    rejectOrder(orderId: ID!, reason: String!): Order!
	    staffRespondOrderRejection(orderId: ID!, message: String!): Order!
	    cancelMyOrder(orderId: ID!): Order!
		    updateMyOrder(orderId: ID!, input: UpdateMyOrderInput!): Order!
		    staffMessageOrder(orderId: ID!, message: String!): Order!
		    customerMessageOrder(orderId: ID!, message: String!): Order!
		    transferOrder(orderId: ID!, serviceCentreId: ID!): Order!
		    deleteOrder(orderId: ID!): Boolean!

	    createFeedback(input: CreateFeedbackInput!): Feedback!

    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    suspendUser(id: ID!): User!
    activateUser(id: ID!): User!
    deleteUser(id: ID!): User!

    sendNotification(input: SendNotificationInput!): Boolean!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    deleteNotification(id: ID!): Boolean!

    createDuty(input: CreateDutyInput!): Duty!
    updateDuty(id: ID!, input: UpdateDutyInput!): Duty!
    addDutyComment(input: AddDutyCommentInput!): DutyComment!

    createHandover(input: CreateHandoverInput!): Handover!
    updateHandover(input: UpdateHandoverInput!): Handover!
    setHandoverStatus(input: SetHandoverStatusInput!): Handover!
    deleteHandover(id: ID!): Boolean!

    deleteActivityLog(id: ID!): Boolean!
  }
`;
