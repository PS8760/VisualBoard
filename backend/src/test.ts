import prisma from "./config/prisma";

async function main() {
    const users = await prisma.users.findMany();
    
    console.log(users);
    
}

main()
    .catch((error) => {
        console.error(error);
        
    })
    .finally(async () => {
        await prisma.$disconnect();
    })