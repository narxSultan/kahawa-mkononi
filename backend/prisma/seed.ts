import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleName, CentreStatus, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: RoleName.ADMIN, description: "System administrator" },
    { name: RoleName.MANAGER, description: "Service centre manager" },
    { name: RoleName.STAFF, description: "Service centre staff" },
    { name: RoleName.CALL_CENTRE_AGENT, description: "Call centre agent" },
    { name: RoleName.CUSTOMER, description: "Customer account" }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role
    });
  }

  const centre = await prisma.serviceCentre.upsert({
    where: { id: "seed-centre" },
    update: {},
    create: {
      id: "seed-centre",
      centreName: "Kahawa Centre - HQ",
      status: CentreStatus.ACTIVE,
      locationName: "Dar es Salaam",
      address: "HQ"
    }
  });

  const password = await bcrypt.hash("Admin@12345", 12);
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } });

  await prisma.user.upsert({
    where: { email: "admin@kahawa.local" },
    update: { roleId: adminRole.id, status: UserStatus.ACTIVE, fullName: "Admin", username: "admin", serviceCentreId: null, deletedAt: null },
    create: {
      email: "admin@kahawa.local",
      username: "admin",
      fullName: "Admin",
      passwordHash: password,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE
    }
  });

  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.MANAGER } });
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.STAFF } });
  const agentRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.CALL_CENTRE_AGENT } });

  const defaultUsers = [
    { email: "staff@kahawa.local", username: "staff", fullName: "Staff", roleId: staffRole.id, password: "Staff@12345", serviceCentreId: centre.id },
    { email: "manager@kahawa.local", username: "manager", fullName: "Manager", roleId: managerRole.id, password: "Manager@12345", serviceCentreId: centre.id },
    { email: "agent@kahawa.local", username: "agent", fullName: "Call Centre Agent", roleId: agentRole.id, password: "Agent@12345", serviceCentreId: null }
  ];

  for (const u of defaultUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, username: u.username, roleId: u.roleId, status: UserStatus.ACTIVE, serviceCentreId: u.serviceCentreId ?? null, deletedAt: null },
      create: {
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        passwordHash: await bcrypt.hash(u.password, 12),
        roleId: u.roleId,
        serviceCentreId: u.serviceCentreId,
        status: UserStatus.ACTIVE
      }
    });
  }

  const services = [
    { name: "Hot Coffee", description: "In-centre hot coffee" },
    { name: "Takeaway Coffee", description: "Takeaway cup coffee" },
    { name: "Office Supply", description: "Office supply" },
    { name: "Event Coffee Service", description: "Events and catering" },
    { name: "Other", description: "Custom service" }
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { name: s.name },
      update: { description: s.description, isActive: true },
      create: s
    });
  }

  const products = [
    { name: "Hot Coffee", description: "Hot coffee", price: "2000", currency: "TZS" },
    { name: "Takeaway Coffee", description: "Takeaway coffee", price: "2500", currency: "TZS" },
    { name: "Office Supply", description: "Office supply", price: "10000", currency: "TZS" },
    { name: "Event Coffee Service", description: "Event coffee service", price: "150000", currency: "TZS" },
    { name: "Other", description: "Other service", price: "0", currency: "TZS" }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { name: p.name },
      update: { description: p.description, price: p.price as any, currency: p.currency, isActive: true },
      create: { name: p.name, description: p.description, price: p.price as any, currency: p.currency, isActive: true }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
