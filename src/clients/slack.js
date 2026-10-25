import { WebClient } from '@slack/web-api';
import 'dotenv/config';

export const slack = new WebClient(process.env.SLACK_TOKEN);
