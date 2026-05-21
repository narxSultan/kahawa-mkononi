import { Injectable, signal } from "@angular/core";

export type Lang = "sw" | "en";

@Injectable({ providedIn: "root" })
export class I18nService {
  lang = signal<Lang>(this.readLang());

  private strings: Record<string, { en: string; sw: string }> = {
    // Shell / common
    "Coffee Service Management": { en: "Coffee Service Management", sw: "Usimamizi wa Huduma ya Kahawa" },
    Logout: { en: "Logout", sw: "Toka" },
    Notifications: { en: "Notifications", sw: "Taarifa" },
    Inbox: { en: "Inbox", sw: "Kikasha" },
    Refresh: { en: "Refresh", sw: "Sasisha" },
    Close: { en: "Close", sw: "Funga" },
    Unread: { en: "Unread", sw: "Haijasomwa" },
    Read: { en: "Read", sw: "Imesomwa" },
    All: { en: "All", sw: "Zote" },
    "All notifications": { en: "All notifications", sw: "Taarifa zote" },
    "No unread notifications": { en: "No unread notifications", sw: "Hakuna taarifa mpya" },
    System: { en: "System", sw: "Mfumo" },
    "Type a reply...": { en: "Type a reply...", sw: "Andika jibu..." },
    Send: { en: "Send", sw: "Tuma" },
    "No messages": { en: "No messages", sw: "Hakuna ujumbe" },

    // Navigation / pages (titles)
    Dashboard: { en: "Dashboard", sw: "Dashibodi" },
    Customers: { en: "Customers", sw: "Wateja" },
    Products: { en: "Products", sw: "Bidhaa" },
    Sales: { en: "Sales", sw: "Mauzo" },
    Stock: { en: "Stock", sw: "Stoo" },
    "Service Centres": { en: "Service Centres", sw: "Vituo" },
    Users: { en: "Users", sw: "Watumiaji" },
    "Send Message": { en: "Send Message", sw: "Tuma Ujumbe" },
    "Duty Assignment": { en: "Duty Assignment", sw: "Mgao wa Kazi" },
    "My Duties": { en: "My Duties", sw: "Kazi Zangu" },
    Handover: { en: "Handover", sw: "Uhamisho" },
    Reports: { en: "Reports", sw: "Ripoti" },
    "Activity Logs": { en: "Activity Logs", sw: "Rekodi" },
    "My Profile": { en: "My Profile", sw: "Wasifu Wangu" },

    // Common buttons / table text
    Cancel: { en: "Cancel", sw: "Ghairi" },
    Save: { en: "Save", sw: "Hifadhi" },
    Create: { en: "Create", sw: "Tengeneza" },
    Delete: { en: "Delete", sw: "Futa" },
    Edit: { en: "Edit", sw: "Hariri" },
    View: { en: "View", sw: "Tazama" },
    Centre: { en: "Centre", sw: "Kituo" },
    Service: { en: "Service", sw: "Huduma" },
    Cups: { en: "Cups", sw: "Vikombe" },
    Takeaway: { en: "Takeaway", sw: "Kuchukua" },
    Amount: { en: "Amount", sw: "Kiasi" },
    At: { en: "At", sw: "Muda" },
    Balance: { en: "Balance", sw: "Salio" },
    Threshold: { en: "Threshold", sw: "Kiwango" },
    Name: { en: "Name", sw: "Jina" },
    Phone: { en: "Phone", sw: "Simu" },
    Address: { en: "Address", sw: "Anuani" },
    Type: { en: "Type", sw: "Aina" },
    Created: { en: "Created", sw: "Iliundwa" },
    Customer: { en: "Customer", sw: "Mteja" },
    Staff: { en: "Staff", sw: "Mfanyakazi" },
    Status: { en: "Status", sw: "Hali" },
    Start: { en: "Start", sw: "Mwanzo" },
    End: { en: "End", sw: "Mwisho" },
    Permissions: { en: "Permissions", sw: "Ruhusa" },
    Item: { en: "Item", sw: "Bidhaa" },
    Unit: { en: "Unit", sw: "Kipimo" },
    Low: { en: "Low", sw: "Chini" },
    Qty: { en: "Qty", sw: "Idadi" },
    In: { en: "In", sw: "Iliyoingia" },
    Out: { en: "Out", sw: "Iliyotoka" },
    Quantity: { en: "Quantity", sw: "Kiasi" },
    Note: { en: "Note", sw: "Kumbukumbu" },
    Location: { en: "Location", sw: "Eneo" },
    Manager: { en: "Manager", sw: "Meneja" },
    User: { en: "User", sw: "Mtumiaji" },
    Module: { en: "Module", sw: "Moduli" },
    Action: { en: "Action", sw: "Kitendo" },
    Description: { en: "Description", sw: "Maelezo" },
    Price: { en: "Price", sw: "Bei" },
    Currency: { en: "Currency", sw: "Sarafu" },
    Image: { en: "Image", sw: "Picha" },
    Active: { en: "Active", sw: "Hai" },
    Inactive: { en: "Inactive", sw: "Isiyo hai" },
    Preview: { en: "Preview", sw: "Hakiki" },
    "Remove image": { en: "Remove image", sw: "Ondoa picha" },
    "Manage products and prices": { en: "Create, edit, and manage product prices", sw: "Tengeneza, hariri na simamia bidhaa na bei" },
    "Add product": { en: "Add product", sw: "Ongeza bidhaa" },
    "Edit product": { en: "Edit product", sw: "Hariri bidhaa" },
    "Create product": { en: "Create product", sw: "Tengeneza bidhaa" },
    "Image upload is optional": { en: "Image upload is optional.", sw: "Kupakia picha ni hiari." },
    "Image (optional)": { en: "Image (optional)", sw: "Picha (hiari)" },
    Current: { en: "Current", sw: "Iliyopo" },
    Remove: { en: "Remove", sw: "Ondoa" },
    Activate: { en: "Activate", sw: "Washa" },
    "Remove product?": { en: "Remove product?", sw: "Ondoa bidhaa?" },
    "This will hide the product from customers": { en: "This will hide the product from customers.", sw: "Hii itaficha bidhaa kwa wateja." },
    "Search...": { en: "Search...", sw: "Tafuta..." },
    "No products": { en: "No products", sw: "Hakuna bidhaa" },

    // Customer ordering
    "Create Order": { en: "Create Order", sw: "Tengeneza Oda" },
    "Choose a product and place an order": { en: "Choose a product and place an order", sw: "Chagua bidhaa na weka oda" },
    "Service centre": { en: "Service centre", sw: "Kituo cha huduma" },
    "Search product": { en: "Search product", sw: "Tafuta bidhaa" },
    "Order created": { en: "Order created", sw: "Oda imetengenezwa" },
    "View my orders": { en: "View my orders", sw: "Tazama oda zangu" },
    Order: { en: "Order", sw: "Weka oda" },
    "Hot Coffee": { en: "Hot Coffee", sw: "Kahawa ya moto" },
    "Takeaway Coffee": { en: "Takeaway Coffee", sw: "Kahawa ya kuchukua" },
    "Office Supply": { en: "Office Supply", sw: "Huduma ya ofisi" },
    "Event Coffee Service": { en: "Event Coffee Service", sw: "Huduma ya kahawa kwa tukio" },
    Other: { en: "Other", sw: "Nyingine" },
    Total: { en: "Total", sw: "Jumla" },
    Items: { en: "Items", sw: "Bidhaa" },
    Visits: { en: "Visits", sw: "Ziara" },
    Title: { en: "Title", sw: "Kichwa" },
    "Assigned to": { en: "Assigned to", sw: "Aliyegawiwa" },
    Priority: { en: "Priority", sw: "Kipaumbele" },
    Due: { en: "Due", sw: "Mwisho" },
    Joined: { en: "Joined", sw: "Alijiunga" },
    Role: { en: "Role", sw: "Wadhifa" },
    "Low threshold": { en: "Low threshold", sw: "Kiwango cha chini" },
    "Low stock": { en: "Low stock", sw: "Stoo-chini" },
    "Total balance": { en: "Total balance", sw: "Jumla ya salio" },
    "Select...": { en: "Select...", sw: "Chagua..." },
    "Select centre...": { en: "Select centre...", sw: "Chagua kituo..." },
    "(none)": { en: "(none)", sw: "(hakuna)" },
    "All centres": { en: "All centres", sw: "Vituo vyote" },
    "All roles": { en: "All roles", sw: "Majukumu yote" },
    "Active + Suspended": { en: "Active + Suspended", sw: "Hai + Zilizositishwa" },
    "All users": { en: "All users", sw: "Watumiaji wote" },
    "Short title": { en: "Short title", sw: "Kichwa kifupi" },
    "Message sent.": { en: "Message sent.", sw: "Ujumbe umetumwa." },
    "Managers can only message their own centre.": {
      en: "Managers can only message their own centre.",
      sw: "Mameneja wanaweza kutuma kwa kituo chao pekee."
    },
    "Assign to staff": { en: "Assign to staff", sw: "Mkabidhi mfanyakazi" },
    "Manage users": { en: "Manage users", sw: "Simamia watumiaji" },
    "Send notifications": { en: "Send notifications", sw: "Tuma taarifa" },
    "Assign duties": { en: "Assign duties", sw: "Gawa kazi" },
    "View reports": { en: "View reports", sw: "Tazama ripoti" },
    "Assign new duty": { en: "Assign new duty", sw: "Gawa kazi mpya" },
    "Coffee beans": { en: "Coffee beans", sw: "Maharage ya kahawa" },
    "kg / cups / packs": { en: "kg / cups / packs", sw: "kg / vikombe / pakiti" },
    "Individual / Office / Event": { en: "Individual / Office / Event", sw: "Mtu binafsi / Ofisi / Tukio" },
    optional: { en: "optional", sw: "hiari" },
    Notes: { en: "Notes", sw: "Maelezo" },
    Reason: { en: "Reason", sw: "Sababu" },
    "Start date": { en: "Start date", sw: "Tarehe ya kuanza" },
    "End date": { en: "End date", sw: "Tarehe ya mwisho" },
    "Due date": { en: "Due date", sw: "Tarehe ya mwisho" },
    "Assign to": { en: "Assign to", sw: "Gawa kwa" },
    Receiver: { en: "Receiver", sw: "Mpokeaji" },
    "Send mode": { en: "Send mode", sw: "Njia ya kutuma" },
    "One user": { en: "One user", sw: "Mtumiaji mmoja" },
    "Target role": { en: "Target role", sw: "Wadhifa lengwa" },
    Message: { en: "Message", sw: "Ujumbe" },
    "Write your message...": { en: "Write your message...", sw: "Andika ujumbe wako..." },
    "Leave / travel / other": { en: "Leave / travel / other", sw: "Likizo / safari / nyingine" },
    "Search name or phone": { en: "Search name or phone", sw: "Tafuta jina au simu" },
    "Search name / location": { en: "Search name / location", sw: "Tafuta jina / eneo" },
    "Search name, email, phone, username": { en: "Search name, email, phone, username", sw: "Tafuta jina, barua pepe, simu, jina la mtumiaji" },
    "Customer type": { en: "Customer type", sw: "Aina ya mteja" },
    "Full name": { en: "Full name", sw: "Jina kamili" },
    Username: { en: "Username", sw: "Jina la mtumiaji" },
    "Min 8+ chars": { en: "Min 8+ chars", sw: "Angalau herufi 8+" },
    "Reset password (optional)": { en: "Reset password (optional)", sw: "Badilisha nenosiri (hiari)" },
    "Leave blank to keep current password": { en: "Leave blank to keep current password", sw: "Acha wazi kubaki na nenosiri la sasa" },
    "Location name": { en: "Location name", sw: "Jina la eneo" },
    "Centre name": { en: "Centre name", sw: "Jina la kituo" },
    "Manager name": { en: "Manager name", sw: "Jina la meneja" },
    "Customer search": { en: "Customer search", sw: "Tafuta mteja" },
    "Custom service": { en: "Custom service", sw: "Huduma maalum" },
    "Cups sold": { en: "Cups sold", sw: "Vikombe vilivyouzwa" },
    "Takeaway cups used": { en: "Takeaway cups used", sw: "Vikombe vya kuchukua vilivyotumika" },
    "Amount (TZS)": { en: "Amount (TZS)", sw: "Kiasi (TZS)" },
    "(custom)": { en: "(custom)", sw: "(maalum)" },
    "Low stock threshold": { en: "Low stock threshold", sw: "Kiwango cha stoo-chini" },
    "Stock items": { en: "Stock items", sw: "Bidhaa za stoo" },
    "Edit stock item": { en: "Edit stock item", sw: "Hariri bidhaa ya stoo" },
    "Remove stock item?": { en: "Remove stock item?", sw: "Ondoa bidhaa ya stoo?" },
    "This will deactivate the stock item": { en: "This will deactivate the stock item.", sw: "Hii itasitisha (kuficha) bidhaa ya stoo." },
    "Stock movement": { en: "Stock movement", sw: "Miamala ya stoo" },
    "Recent movements": { en: "Recent movements", sw: "Miamala ya karibuni" },
    "Create service centre": { en: "Create service centre", sw: "Tengeneza kituo" },
    "Edit service centre": { en: "Edit service centre", sw: "Hariri kituo" },

    // Login
    "Sign in to your dashboard": { en: "Sign in to your dashboard", sw: "Ingia kwenye dashibodi yako" },
    Email: { en: "Email", sw: "Barua pepe" },
    Password: { en: "Password", sw: "Nenosiri" },
    Login: { en: "Login", sw: "Ingia" },
    "Signing in...": { en: "Signing in...", sw: "Inaingia..." },
    "Sending...": { en: "Sending...", sw: "Inatuma..." },

    // Common actions
    Search: { en: "Search", sw: "Tafuta" },
    "Add Sale": { en: "Add Sale", sw: "Ongeza Mauzo" },
    "New Customer": { en: "New Customer", sw: "Mteja Mpya" },
    "New Item": { en: "New Item", sw: "Bidhaa Mpya" },
    "Save movement": { en: "Save movement", sw: "Hifadhi uingizaji/utokaji" },
    Back: { en: "Back", sw: "Rudi" },
    "Save changes": { en: "Save changes", sw: "Hifadhi mabadiliko" },
    Suspend: { en: "Suspend", sw: "Sitisha" },
    Assign: { en: "Assign", sw: "Gawa" },
    Comment: { en: "Comment", sw: "Toa maoni" },
    "Load more": { en: "Load more", sw: "Onyesha zaidi" },

    // Page titles
    "Stock Control": { en: "Stock Control", sw: "Udhibiti wa Stoo" },
    "Sales & Cup Counter": { en: "Sales & Cup Counter", sw: "Mauzo na Kaunta ya Vikombe" },
    "Responsibility Handover": { en: "Responsibility Handover", sw: "Uhamisho wa Majukumu" },
    "User Management": { en: "User Management", sw: "Usimamizi wa Watumiaji" },
    "Add User": { en: "Add User", sw: "Ongeza Mtumiaji" },
    "Edit User": { en: "Edit User", sw: "Hariri Mtumiaji" },
    "User Profile": { en: "User Profile", sw: "Wasifu wa Mtumiaji" },
    "New Centre": { en: "New Centre", sw: "Kituo Kipya" },
    "Create handover": { en: "Create handover", sw: "Tengeneza uhamisho" },
    // Dashboard
    "Phase 1 MVP overview": { en: "Phase 1 MVP overview", sw: "Muhtasari wa awamu ya 1" },
    "Total Customers": { en: "Total Customers", sw: "Jumla ya Wateja" },
    "Total Service Centres": { en: "Total Service Centres", sw: "Jumla ya Vituo" },
    "Cups Sold (Today)": { en: "Cups Sold (Today)", sw: "Vikombe vilivyouzwa (Leo)" },
    "Takeaway Cups (Today)": { en: "Takeaway Cups (Today)", sw: "Vikombe vya kuchukua (Leo)" },
    "Sales (Today)": { en: "Sales (Today)", sw: "Mauzo (Leo)" },
    "Low Stock Items": { en: "Low Stock Items", sw: "Bidhaa stoo-chini" },
    "Recent Sales": { en: "Recent Sales", sw: "Mauzo ya Karibuni" },
    "Latest 10 records": { en: "Latest 10 records", sw: "Rekodi 10 za mwisho" },
    "No sales yet": { en: "No sales yet", sw: "Bado hakuna mauzo" },
    "Stock Summary": { en: "Stock Summary", sw: "Muhtasari wa Stoo" },
    "Low stock highlights for selected centre": { en: "Low stock highlights for selected centre", sw: "Bidhaa chache za stoo kwa kituo kilichochaguliwa" },
    "No low stock items": { en: "No low stock items", sw: "Hakuna bidhaa stoo-chini" },
    "No data": { en: "No data", sw: "Hakuna data" },
    "No stock items": { en: "No stock items", sw: "Hakuna bidhaa za stoo" },
    "No movements": { en: "No movements", sw: "Hakuna miamala ya stoo" },
    "No users found": { en: "No users found", sw: "Hakuna watumiaji waliopatikana" },
    "No handovers": { en: "No handovers", sw: "Hakuna uhamisho" },
    "No centres found": { en: "No centres found", sw: "Hakuna vituo vilivyopatikana" },
    "No sales found": { en: "No sales found", sw: "Hakuna mauzo yaliyopatikana" },

    // Reports / KPIs / exports
    "Users CSV": { en: "Users CSV", sw: "Watumiaji CSV" },
    "Users PDF": { en: "Users PDF", sw: "Watumiaji PDF" },
    "Total Users": { en: "Total Users", sw: "Jumla ya Watumiaji" },
    Suspended: { en: "Suspended", sw: "Imesitishwa" },
    Deleted: { en: "Deleted", sw: "Imefutwa" },
    "Stock IN (30d)": { en: "Stock IN (30d)", sw: "Stoo IN (siku 30)" },
    "Stock OUT (30d)": { en: "Stock OUT (30d)", sw: "Stoo OUT (siku 30)" },
    CSV: { en: "CSV", sw: "CSV" },
    PDF: { en: "PDF", sw: "PDF" },
    "Users by role": { en: "Users by role", sw: "Watumiaji kwa wadhifa" },
    "Counts excluding deleted": { en: "Counts excluding deleted", sw: "Hesabu bila waliOfutwa" },
    "Users by service centre": { en: "Users by service centre", sw: "Watumiaji kwa kituo" },
    "Stocks by service centre": { en: "Stocks by service centre", sw: "Stoo kwa kituo" },
    "Active items, low stock, total balance": { en: "Active items, low stock, total balance", sw: "Bidhaa hai, stoo-chini, jumla ya salio" },
    "Top customers (30 days)": { en: "Top customers (30 days)", sw: "Wateja bora (siku 30)" },
    "Most frequent visits": { en: "Most frequent visits", sw: "Ziara za mara kwa mara" },
    "Stock balances": { en: "Stock balances", sw: "Masalio ya stoo" },
    "Per item (selected centre)": { en: "Per item (selected centre)", sw: "Kwa kila bidhaa (kituo kilichochaguliwa)" },
    "Users Report": { en: "Users Report", sw: "Ripoti ya Watumiaji" },
    "Users by Role": { en: "Users by Role", sw: "Watumiaji kwa Wadhifa" },
    "Users by Service Centre": { en: "Users by Service Centre", sw: "Watumiaji kwa Kituo" },
    "Stocks by Service Centre": { en: "Stocks by Service Centre", sw: "Stoo kwa Kituo" },
    "Top Customers (Frequent Visits)": { en: "Top Customers (Frequent Visits)", sw: "Wateja Bora (Ziara nyingi)" },
    "Stock Balances": { en: "Stock Balances", sw: "Masalio ya Stoo" },

    // Customers
    "Create, search, and manage customer contacts": { en: "Create, search, and manage customer contacts", sw: "Tengeneza, tafuta, na simamia taarifa za wateja" },
    "Create customer": { en: "Create customer", sw: "Tengeneza mteja" },
    "Edit customer": { en: "Edit customer", sw: "Hariri mteja" },
    "No customers found": { en: "No customers found", sw: "Hakuna wateja waliopatikana" },

    // Users
    "Create, search, and manage accounts": { en: "Create, search, and manage accounts", sw: "Tengeneza, tafuta, na simamia akaunti" },
    "Create a new account": { en: "Create a new account", sw: "Tengeneza akaunti mpya" },
    "Create user": { en: "Create user", sw: "Tengeneza mtumiaji" },
    "Update account information": { en: "Update account information", sw: "Sasisha taarifa za akaunti" },
    "Account details, duties, and activity": { en: "Account details, duties, and activity", sw: "Taarifa za akaunti, kazi, na rekodi" },
    "No duties": { en: "No duties", sw: "Hakuna kazi" },
    "No activity": { en: "No activity", sw: "Hakuna rekodi" },

    // Service centres
    "Add, edit, suspend, or review service centres": { en: "Add, edit, suspend, or review service centres", sw: "Ongeza, hariri, sitisha, au kagua vituo" },

    // Sales
    "Record sales per customer, centre, and service type": { en: "Record sales per customer, centre, and service type", sw: "Rekodi mauzo kwa mteja, kituo, na aina ya huduma" },
    "Sales Today": { en: "Sales Today", sw: "Mauzo Leo" },
    "Sales This Week": { en: "Sales This Week", sw: "Mauzo Wiki Hii" },
    "Sales This Month": { en: "Sales This Month", sw: "Mauzo Mwezi Huu" },
    "Create sale": { en: "Create sale", sw: "Tengeneza mauzo" },

    // Stock
    "Track stock in/out, balance, and low stock alerts per centre": {
      en: "Track stock in/out, balance, and low stock alerts per centre",
      sw: "Fuatilia uingizaji/utokaji wa stoo, salio, na tahadhari ya stoo-chini kwa kila kituo"
    },

    // Duties
    "Assign duties to staff under a service centre": { en: "Assign duties to staff under a service centre", sw: "Gawa kazi kwa wafanyakazi wa kituo" },
    "Update your task progress": { en: "Update your task progress", sw: "Sasisha maendeleo ya kazi zako" },
    "No duties assigned": { en: "No duties assigned", sw: "Hakuna kazi zilizogawiwa" },

    // Messages
    "Send notifications to users": { en: "Send notifications to users", sw: "Tuma taarifa kwa watumiaji" },

    // Reports
    "Admin & manager reporting dashboard": { en: "Admin & manager reporting dashboard", sw: "Dashibodi ya ripoti (Admin/Manager)" },

    // Activity logs
    "Audit trail of important actions": { en: "Audit trail of important actions", sw: "Rekodi ya hatua muhimu" },
    "All modules": { en: "All modules", sw: "Moduli zote" },
    "User management": { en: "User management", sw: "Usimamizi wa watumiaji" },
    "Notifications module": { en: "Notifications", sw: "Taarifa" },
    "Duties module": { en: "Duties", sw: "Kazi" },
    "Handover module": { en: "Handover", sw: "Uhamisho" },
    "No activity logs": { en: "No activity logs", sw: "Hakuna rekodi za shughuli" },

    // Profile
    "Account overview, duties, and notifications": { en: "Account overview, duties, and notifications", sw: "Muhtasari wa akaunti, kazi, na taarifa" },
    "No notifications": { en: "No notifications", sw: "Hakuna taarifa" },
    "Assigned tasks": { en: "Assigned tasks", sw: "Kazi zilizogawiwa" },
    "Delegate selected manager tasks to staff during leave": {
      en: "Delegate selected manager tasks to staff during leave",
      sw: "Hamisha majukumu ya meneja uliyachagua kwa mfanyakazi wakati wa likizo"
    },

    // Profile
    Account: { en: "Account", sw: "Akaunti" },
    "Loading...": { en: "Loading...", sw: "Inapakia..." }
  };

  private readLang(): Lang {
    try {
      const v = (localStorage.getItem("lang") ?? "").toLowerCase();
      if (v === "sw" || v === "en") return v;
    } catch {
      // ignore
    }
    return "sw";
  }

  constructor() {
    try {
      document.documentElement.lang = this.lang();
    } catch {
      // ignore
    }
  }

  setLang(v: Lang) {
    const next: Lang = v === "en" ? "en" : "sw";
    this.lang.set(next);
    try {
      localStorage.setItem("lang", next);
      document.documentElement.lang = next;
    } catch {
      // ignore
    }
  }

  t(key: string): string {
    const l = this.lang();
    const entry = this.strings[key];
    if (!entry) return key;
    return entry[l] ?? entry.en ?? key;
  }
}
