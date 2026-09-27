
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
async function main(){
  await prisma.order.deleteMany().catch(()=>{})
  await prisma.table.deleteMany().catch(()=>{})
  await prisma.menuItem.deleteMany().catch(()=>{})
  await prisma.menuCategory.deleteMany().catch(()=>{})
  await prisma.user.deleteMany().catch(()=>{})
  await prisma.driver.deleteMany().catch(()=>{})
  await prisma.subscriptionLog.deleteMany().catch(()=>{})
  await prisma.restaurant.deleteMany().catch(()=>{})

  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'مشويات التحرير',
      slug: 'el-tahrir',
      domain: 'el-tahrir.maqr.cloud',
      ownerName: 'بولا عادل',
      ownerPhone: '+201000000000',
      subscriptionEnd: new Date(Date.now()+365*24*60*60*1000),
      planPrice: 1200,
      tables: { create: Array.from({length:12}, (_,i)=>({ number: i+1, status: 'AVAILABLE' as any })) },
      categories: { create: [
        { name: 'مشويات', order: 1 },
        { name: 'بيتزا', order: 2 },
        { name: 'مشروبات', order: 3 }
      ]}
    },
    include: { categories: true }
  })
  const cats = restaurant.categories
  await prisma.menuItem.createMany({ data: [
    { name: 'كفتة مشوية', price: 120, categoryId: cats[0].id, restaurantId: restaurant.id, available: true },
    { name: 'شيش طاووق', price: 140, categoryId: cats[0].id, restaurantId: restaurant.id, available: true },
    { name: 'بيتزا مارجريتا', price: 90, categoryId: cats[1].id, restaurantId: restaurant.id, available: true },
    { name: 'بيتزا بيبروني', price: 110, categoryId: cats[1].id, restaurantId: restaurant.id, available: true },
    { name: 'بيبسي', price: 25, categoryId: cats[2].id, restaurantId: restaurant.id, available: true },
    { name: 'مياه', price: 15, categoryId: cats[2].id, restaurantId: restaurant.id, available: true },
  ]})
  const hash = (p:string)=> bcrypt.hashSync(p, 10)
  // NOTE: UserRole enum (schema.prisma) is SUPER_ADMIN | RESTAURANT_ADMIN | CASHIER | KITCHEN | DRIVER.
  // The previous version of this file used role: 'OWNER', which isn't a valid
  // enum value and would throw at seed time.
  await prisma.user.createMany({ data: [
    { email:'super@maqr.cloud', password: hash('super123'), name:'سوبر ادمن', role:'SUPER_ADMIN' as any },
    { email:'owner@el-tahrir.com', password: hash('owner123'), name:'صاحب المطعم', role:'RESTAURANT_ADMIN' as any, restaurantId: restaurant.id },
    { email:'cashier@el-tahrir.com', password: hash('cashier123'), name:'كاشير', role:'CASHIER' as any, restaurantId: restaurant.id },
    { email:'kitchen@el-tahrir.com', password: hash('kitchen123'), name:'شيف المطبخ', role:'KITCHEN' as any, restaurantId: restaurant.id },
    { email:'driver@el-tahrir.com', password: hash('driver123'), name:'احمد الطيار', role:'DRIVER' as any, restaurantId: restaurant.id },
  ]})
  // NOTE: the Driver model (delivery staff roster - name/phone/earnings) has
  // no `password` column, it's a separate concept from the User/login table
  // above. We link the two so the logged-in driver account can find "my
  // deliveries": Driver.userId -> User.id.
  const driverUser = await prisma.user.findUnique({ where: { email: 'driver@el-tahrir.com' } })
  await prisma.driver.create({
    data: { name: 'احمد الطيار', phone: '+201111111111', restaurantId: restaurant.id, userId: driverUser?.id },
  })
  await prisma.driver.create({
    data: { name: 'محمد الطيار', phone: '+201222222222', restaurantId: restaurant.id },
  })
  console.log('✅ Seed done')
}
main().finally(()=>prisma.$disconnect())
