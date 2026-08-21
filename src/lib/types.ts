export type Category =
  | 'Canned'
  | 'Produce'
  | 'Dairy'
  | 'Grains'
  | 'Frozen'
  | 'Protein'
  | 'Beverages'
  | 'Household';

export type Status = 'OK' | 'Low' | 'Expiring' | 'Out';

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  expirationDate: string; // ISO 'YYYY-MM-DD'
  location: string;
  reorderThreshold: number;
  lastUpdated: string; // ISO 'YYYY-MM-DD'
}

export interface DonationItem {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
}

export interface Donation {
  id: string;
  date: string; // ISO 'YYYY-MM-DD'
  donorName: string;
  donorType: 'individual' | 'grocery' | 'corporate' | 'food-drive';
  items: DonationItem[];
  notes?: string;
}

export interface DistributionItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface Distribution {
  id: string;
  date: string; // ISO 'YYYY-MM-DD'
  recipient: string;
  type: 'household' | 'partner-agency' | 'mobile-pantry';
  items: DistributionItem[];
  householdsServed?: number;
  notes?: string;
}
