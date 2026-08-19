import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { uid } from '../src/utils/id.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = 'Password123!';

type SeedElement = Record<string, unknown> & { id: string };

const rect = (id: string, x: number, y: number, width: number, height: number, fill: string, stroke: string): SeedElement => ({
  id,
  kind: 'rect',
  x,
  y,
  width,
  height,
  rotation: 0,
  fill,
  stroke,
  strokeWidth: 2,
  radius: 8,
  content: '',
  version: 1,
});

const text = (id: string, x: number, y: number, content: string, fontSize: number, fill: string, bold = false): SeedElement => ({
  id,
  kind: 'text',
  x,
  y,
  width: 200,
  height: 30,
  rotation: 0,
  fill,
  stroke: '#c2c0b5',
  strokeWidth: 1.5,
  fontSize,
  fontWeight: bold ? 'bold' : undefined,
  content,
  version: 1,
});

const ellipse = (id: string, x: number, y: number, width: number, height: number, fill: string, stroke: string): SeedElement => ({
  id,
  kind: 'circle',
  x,
  y,
  width,
  height,
  rotation: 0,
  fill,
  stroke,
  strokeWidth: 2,
  content: '',
  version: 1,
});

const demoElements: SeedElement[] = [
  rect(uid('el'), 80, 80, 220, 140, '#fff3d6', '#d14009'),
  text(uid('el'), 110, 110, 'VisualBoard', 28, '#18202e', true),
  text(uid('el'), 110, 155, 'A realtime whiteboard for developers', 16, '#5b6472'),
  rect(uid('el'), 380, 80, 260, 140, '#e7f4ff', '#2b6cb0'),
  text(uid('el'), 410, 110, 'Built with Fabric.js', 18, '#1a365d', true),
  text(uid('el'), 410, 155, 'Canvas → elements → versioned snapshots.\nComments pins, documents, cursors.', 14, '#2c5282'),
  ellipse(uid('el'), 380, 300, 260, 160, '#ffedd5', '#d14009'),
  text(uid('el'), 430, 360, 'Realtime. Versioned. Yours.', 16, '#7c2d12', true),
];

async function main() {
  console.log('Seeding development database...');

  const pw = await bcrypt.hash(DEV_PASSWORD, Number(process.env.BCRYPT_SALT_ROUNDS) || 10);

  const owner = await prisma.users.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: { name: 'Demo Owner', email: 'owner@example.com', password: pw },
  });

  const editor = await prisma.users.upsert({
    where: { email: 'editor@example.com' },
    update: {},
    create: { name: 'Demo Editor', email: 'editor@example.com', password: pw },
  });

  const viewer = await prisma.users.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: { name: 'Demo Viewer', email: 'viewer@example.com', password: pw },
  });

  const board = await prisma.boards.upsert({
    where: { id: 1 },
    update: { title: 'Demo Board', description: 'Demo board for VisualBoard', owner_id: owner.id },
    create: {
      id: 1,
      title: 'Demo Board',
      description: 'Demo board for VisualBoard',
      owner_id: owner.id,
    },
  });

  await prisma.board_members.upsert({
    where: { user_id_board_id: { user_id: owner.id, board_id: board.id } },
    update: { role: 'owner' },
    create: { user_id: owner.id, board_id: board.id, role: 'owner' },
  });
  await prisma.board_members.upsert({
    where: { user_id_board_id: { user_id: editor.id, board_id: board.id } },
    update: { role: 'editor' },
    create: { user_id: editor.id, board_id: board.id, role: 'editor' },
  });
  await prisma.board_members.upsert({
    where: { user_id_board_id: { user_id: viewer.id, board_id: board.id } },
    update: { role: 'viewer' },
    create: { user_id: viewer.id, board_id: board.id, role: 'viewer' },
  });

  for (const element of demoElements) {
    await prisma.elements.create({
      data: {
        id: element.id,
        board_id: board.id,
        element_data: { ...element, id: undefined },
      },
    });
  }

  const elements = await prisma.elements.findMany({
    where: { board_id: board.id },
    select: { id: true, element_data: true },
  });
  const snapshot = elements.map((el) => ({ ...(el.element_data as object), id: el.id }));

  await prisma.comments.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      board_id: board.id,
      user_id: editor.id,
      content: 'Nice, a template! Clone it and make it yours.',
      x_position: 420,
      y_position: 250,
    },
  });

  await prisma.versions.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      board_id: board.id,
      created_by: owner.id,
      snapshot,
    },
  });

  console.log('Seeding complete. Demo users:');
  console.log(`  owner@example.com / ${DEV_PASSWORD} (owner)`);
  console.log(`  editor@example.com / ${DEV_PASSWORD} (editor)`);
  console.log(`  viewer@example.com / ${DEV_PASSWORD} (viewer)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });