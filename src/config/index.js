import 'dotenv/config';

export const port = process.env.PORT || 3000;

export const Members_Database_ID = process.env.MEMBERS_DATABASE_ID;
export const Batches_Database_ID = process.env.BATCHES_DATABASE_ID;
export const Award_Tiers_Database_ID = process.env.AWARD_TIERS_DATABASE_ID;

export const tierToHours = {
  'bronze': 50,
  'silver': 100,
  'gold': 150,
  'platinum': 200,
  'diamond': 250,
};
