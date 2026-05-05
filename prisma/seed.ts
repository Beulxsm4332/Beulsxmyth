import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // Seed Games
  const games = [
    { name: "Blox Fruits", placeId: "2753915549", description: "Find and eat fruits to gain powers", playerCount: 245831, thumbnail: "https://tr.rbxcdn.com/180DAY-4c48cf78d464b6e8c44b1c3ec54b4ea8/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Brookhaven RP", placeId: "4924922222", description: "Roleplay in a modern city", playerCount: 512047, thumbnail: "https://tr.rbxcdn.com/180DAY-dde5cb5a99e0bf43e2cf15b1fc8e8dc8/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Adopt Me!", placeId: "920587237", description: "Adopt and raise cute pets", playerCount: 178923, thumbnail: "https://tr.rbxcdn.com/180DAY-2f1b6d45a2b8d53e87ea11c6b98e4c1e/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Murder Mystery 2", placeId: "142823291", description: "Survive the murderer or be the murderer", playerCount: 89421, thumbnail: "https://tr.rbxcdn.com/180DAY-939cc49f19fd7b90b8685e8d9e5c7f0a/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Tower of Hell", placeId: "1962086868", description: "Climb a randomly generated obby tower", playerCount: 45672, thumbnail: "https://tr.rbxcdn.com/180DAY-8f1d4e16c6b80ab281df93b6a5e76e59/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Arsenal", placeId: "286090429", description: "Fast-paced FPS shooter game", playerCount: 67234, thumbnail: "https://tr.rbxcdn.com/180DAY-4b9e1c24cf75d8bb36e2b5c9c7eb84f8/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Pet Simulator X", placeId: "6284583030", description: "Collect and trade pets", playerCount: 123456, thumbnail: "https://tr.rbxcdn.com/180DAY-e4ddc14be8e60e7e7a5ef15b8ee1a3a4/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Natural Disaster Survival", placeId: "189707", description: "Survive various natural disasters", playerCount: 34521, thumbnail: "https://tr.rbxcdn.com/180DAY-1e2e8c3ab49c7d8e9f0a1b2c3d4e5f6a/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Jailbreak", placeId: "606849621", description: "Prison escape and police chase game", playerCount: 98765, thumbnail: "https://tr.rbxcdn.com/180DAY-7a1b2c3d4e5f6a8b9c0d1e2f3a4b5c6d/150/150/Image/Webp/noFilter", status: "online" },
    { name: "King Legacy", placeId: "3457298690", description: "Find devil fruits and become a pirate king", playerCount: 56789, thumbnail: "https://tr.rbxcdn.com/180DAY-2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f/150/150/Image/Webp/noFilter", status: "online" },
    { name: "Doors", placeId: "6516141723", description: "Explore a mysterious hotel with creepy doors", playerCount: 78901, thumbnail: "https://tr.rbxcdn.com/180DAY-0f1e2d3c4b5a69788796a5b4c3d2e1f0/150/150/Image/Webp/noFilter", status: "online" },
    { name: "The Strongest Battlegrounds", placeId: "7462526250", description: "Anime fighting game with special abilities", playerCount: 43210, thumbnail: "https://tr.rbxcdn.com/180DAY-6f7e8d9c0b1a29384756a5b4c3d2e1f0/150/150/Image/Webp/noFilter", status: "online" },
  ];

  for (const game of games) {
    await db.game.upsert({
      where: { placeId: game.placeId },
      update: {},
      create: game,
    });

    // Add servers for each game
    const createdGame = await db.game.findUnique({ where: { placeId: game.placeId } });
    if (createdGame) {
      const serverCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < serverCount; i++) {
        const serverName = `${game.name} Server ${i + 1}`;
        await db.server.create({
          data: {
            gameId: createdGame.id,
            name: serverName,
            status: Math.random() > 0.1 ? "online" : "maintenance",
            playerCount: Math.floor(Math.random() * 50),
          },
        });
      }
    }
  }

  // Seed Scripts
  const scripts = [
    { name: "Auto Farm", description: "Automatically farms resources and XP in supported games", code: "-- Auto Farm Script\nlocal Players = game:GetService('Players')\nlocal LocalPlayer = Players.LocalPlayer\nprint('[Beulrock] Auto Farm started')", category: "farming", isPublic: true, usageCount: 15420 },
    { name: "Speed Hack", description: "Modifies walkspeed for faster movement", code: "-- Speed Hack Script\nlocal Players = game:GetService('Players')\nlocal LocalPlayer = Players.LocalPlayer\nlocal Character = LocalPlayer.Character\nif Character then\n  local Humanoid = Character:FindFirstChild('Humanoid')\n  if Humanoid then\n    Humanoid.WalkSpeed = 50\n    print('[Beulrock] Speed Hack applied')\n  end\nend", category: "movement", isPublic: true, usageCount: 23100 },
    { name: "ESP Wallhack", description: "See players through walls with name tags and distance", code: "-- ESP Script\nlocal Players = game:GetService('Players')\nlocal CoreGui = game:GetService('CoreGui')\nprint('[Beulrock] ESP loaded')", category: "visual", isPublic: true, usageCount: 18700 },
    { name: "Infinite Jump", description: "Jump infinitely without cooldown", code: "-- Infinite Jump Script\nlocal UserInputService = game:GetService('UserInputService')\nlocal LocalPlayer = game:GetService('Players').LocalPlayer\nprint('[Beulrock] Infinite Jump enabled')", category: "movement", isPublic: true, usageCount: 31200 },
    { name: "Teleport Hub", description: "Teleport to any location or player on the map", code: "-- Teleport Hub Script\nlocal Players = game:GetService('Players')\nlocal LocalPlayer = Players.LocalPlayer\nprint('[Beulrock] Teleport Hub loaded')", category: "utility", isPublic: true, usageCount: 9800 },
    { name: "Anti-AFK", description: "Prevents the game from kicking you for being idle", code: "-- Anti-AFK Script\nlocal VirtualUser = game:GetService('VirtualUser')\nlocal Players = game:GetService('Players')\nprint('[Beulrock] Anti-AFK activated')", category: "utility", isPublic: true, usageCount: 45600 },
  ];

  for (const script of scripts) {
    await db.script.upsert({
      where: { id: script.name.toLowerCase().replace(/\s+/g, '-') + '-script' },
      update: {},
      create: { id: script.name.toLowerCase().replace(/\s+/g, '-') + '-script', ...script },
    });
  }

  // Create admin user
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.default.hash('admin123', 12);
  await db.user.upsert({
    where: { email: 'admin@beulrock.com' },
    update: {},
    create: {
      email: 'admin@beulrock.com',
      passwordHash,
      isVerified: true,
      tier: 'admin',
    },
  });

  // Create a test user
  const testPasswordHash = await bcrypt.default.hash('test1234', 12);
  await db.user.upsert({
    where: { email: 'test@beulrock.com' },
    update: {},
    create: {
      email: 'test@beulrock.com',
      passwordHash: testPasswordHash,
      isVerified: true,
      tier: 'premium',
    },
  });

  console.log('Database seeded successfully!');
  console.log('Admin: admin@beulrock.com / admin123');
  console.log('Test user: test@beulrock.com / test1234');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
