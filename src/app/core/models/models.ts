// Core data models for the St. Paul Raffle App

export interface Participant {
  id: number;
  name: string;
  contact_info: string;
  is_eligible: number; // 1 = eligible, 0 = drawn/excluded
  created_at: string;
}

export type PrizeTier = 'Major' | 'Minor';
export type DrawMode = 'bulk' | 'sequential';
export type PrizeStatus = 'pending' | 'active' | 'completed';

export interface Prize {
  id: number;
  title: string;
  description: string;
  image_data: string; // base64
  tier: PrizeTier;
  quantity_total: number;
  quantity_remaining: number;
  draw_mode: DrawMode;
  sequence_order: number;
  status: PrizeStatus;
}

export interface DrawHistory {
  id: number;
  prize_id: number;
  participant_id: number;
  drawn_at: string;
  spin_batch_id: string;
}

export interface DrawHistoryWithDetails extends DrawHistory {
  participant_name: string;
  prize_title: string;
  prize_tier: PrizeTier;
  prize_image_data: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
