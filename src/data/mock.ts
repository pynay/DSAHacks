import type { InventoryItem, Donation, Distribution } from '@/lib/types';

export const seedInventory: InventoryItem[] = [
  { id: 'i1', name: 'Canned Black Beans', category: 'Canned', quantity: 220, unit: 'cans', expirationDate: '2027-03-01', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-10' },
  { id: 'i2', name: 'Canned Corn', category: 'Canned', quantity: 35, unit: 'cans', expirationDate: '2027-01-15', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-12' },
  { id: 'i3', name: 'Peanut Butter', category: 'Protein', quantity: 90, unit: 'jars', expirationDate: '2027-06-01', location: 'Aisle C', reorderThreshold: 30, lastUpdated: '2026-08-05' },
  { id: 'i4', name: 'White Rice', category: 'Grains', quantity: 140, unit: 'lbs', expirationDate: '2027-09-01', location: 'Aisle A', reorderThreshold: 40, lastUpdated: '2026-08-14' },
  { id: 'i5', name: 'Pasta', category: 'Grains', quantity: 28, unit: 'boxes', expirationDate: '2027-02-01', location: 'Aisle A', reorderThreshold: 40, lastUpdated: '2026-08-11' },
  { id: 'i6', name: 'Whole Milk', category: 'Dairy', quantity: 24, unit: 'gallons', expirationDate: '2026-08-27', location: 'Fridge 1', reorderThreshold: 15, lastUpdated: '2026-08-18' },
  { id: 'i7', name: 'Cheddar Cheese', category: 'Dairy', quantity: 12, unit: 'blocks', expirationDate: '2026-08-29', location: 'Fridge 1', reorderThreshold: 15, lastUpdated: '2026-08-17' },
  { id: 'i8', name: 'Fresh Apples', category: 'Produce', quantity: 60, unit: 'lbs', expirationDate: '2026-08-25', location: 'Produce Bin', reorderThreshold: 30, lastUpdated: '2026-08-19' },
  { id: 'i9', name: 'Carrots', category: 'Produce', quantity: 45, unit: 'lbs', expirationDate: '2026-09-05', location: 'Produce Bin', reorderThreshold: 30, lastUpdated: '2026-08-16' },
  { id: 'i10', name: 'Frozen Chicken', category: 'Frozen', quantity: 80, unit: 'lbs', expirationDate: '2027-01-01', location: 'Freezer 1', reorderThreshold: 40, lastUpdated: '2026-08-13' },
  { id: 'i11', name: 'Frozen Mixed Veg', category: 'Frozen', quantity: 30, unit: 'bags', expirationDate: '2027-04-01', location: 'Freezer 1', reorderThreshold: 40, lastUpdated: '2026-08-09' },
  { id: 'i12', name: 'Canned Tuna', category: 'Protein', quantity: 0, unit: 'cans', expirationDate: '2027-05-01', location: 'Aisle C', reorderThreshold: 30, lastUpdated: '2026-08-15' },
  { id: 'i13', name: 'Cereal', category: 'Grains', quantity: 52, unit: 'boxes', expirationDate: '2027-03-15', location: 'Aisle A', reorderThreshold: 25, lastUpdated: '2026-08-08' },
  { id: 'i14', name: 'Apple Juice', category: 'Beverages', quantity: 40, unit: 'bottles', expirationDate: '2027-02-01', location: 'Aisle D', reorderThreshold: 20, lastUpdated: '2026-08-07' },
  { id: 'i15', name: 'Bottled Water', category: 'Beverages', quantity: 300, unit: 'bottles', expirationDate: '2028-01-01', location: 'Dock', reorderThreshold: 100, lastUpdated: '2026-08-06' },
  { id: 'i16', name: 'Diapers (Size 4)', category: 'Household', quantity: 18, unit: 'packs', expirationDate: '2029-01-01', location: 'Aisle E', reorderThreshold: 20, lastUpdated: '2026-08-04' },
  { id: 'i17', name: 'Toothpaste', category: 'Household', quantity: 65, unit: 'tubes', expirationDate: '2028-06-01', location: 'Aisle E', reorderThreshold: 25, lastUpdated: '2026-08-03' },
  { id: 'i18', name: 'Canned Soup', category: 'Canned', quantity: 110, unit: 'cans', expirationDate: '2027-07-01', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-12' },
  { id: 'i19', name: 'Eggs', category: 'Dairy', quantity: 40, unit: 'dozens', expirationDate: '2026-09-02', location: 'Fridge 2', reorderThreshold: 20, lastUpdated: '2026-08-18' },
  { id: 'i20', name: 'Ground Beef', category: 'Protein', quantity: 25, unit: 'lbs', expirationDate: '2026-12-01', location: 'Freezer 2', reorderThreshold: 30, lastUpdated: '2026-08-14' },
];

export const seedDonations: Donation[] = [
  { id: 'd1', date: '2026-08-18', donorName: 'Sunrise Grocery', donorType: 'grocery', items: [{ name: 'Fresh Apples', category: 'Produce', quantity: 40, unit: 'lbs' }, { name: 'Carrots', category: 'Produce', quantity: 25, unit: 'lbs' }] },
  { id: 'd2', date: '2026-08-15', donorName: 'Community Food Drive', donorType: 'food-drive', items: [{ name: 'Canned Black Beans', category: 'Canned', quantity: 120, unit: 'cans' }, { name: 'Pasta', category: 'Grains', quantity: 30, unit: 'boxes' }] },
  { id: 'd3', date: '2026-08-11', donorName: 'Acme Corp', donorType: 'corporate', items: [{ name: 'Bottled Water', category: 'Beverages', quantity: 200, unit: 'bottles' }] },
  { id: 'd4', date: '2026-08-06', donorName: 'Jane Doe', donorType: 'individual', items: [{ name: 'Peanut Butter', category: 'Protein', quantity: 20, unit: 'jars' }] },
];

export const seedDistributions: Distribution[] = [
  { id: 'x1', date: '2026-08-19', recipient: 'Eastside Shelter', type: 'partner-agency', items: [{ name: 'Canned Black Beans', quantity: 60, unit: 'cans' }, { name: 'White Rice', quantity: 40, unit: 'lbs' }], householdsServed: 45 },
  { id: 'x2', date: '2026-08-17', recipient: 'Mobile Pantry Route 3', type: 'mobile-pantry', items: [{ name: 'Fresh Apples', quantity: 30, unit: 'lbs' }, { name: 'Cereal', quantity: 20, unit: 'boxes' }], householdsServed: 30 },
  { id: 'x3', date: '2026-08-13', recipient: 'Johnson Family', type: 'household', items: [{ name: 'Whole Milk', quantity: 2, unit: 'gallons' }, { name: 'Eggs', quantity: 2, unit: 'dozens' }], householdsServed: 1 },
];
