// ─── Matches backend shared/schema.ts ────────────────────────────────────────

export interface Driver {
  id: number;
  name: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  currentLat?: number;
  currentLng?: number;
}

export interface Delivery {
  id: number;
  batchId: number;
  addressText: string;
  lat?: number;
  lng?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  rxNumber?: string;
  status: 'pending' | 'geocoded' | 'delivered';
}

export interface RouteStop {
  id: number;
  routeId: number;
  deliveryId: number;
  sequence: number;
  status: 'pending' | 'active' | 'completed';
  eta?: string;
  actualArrival?: string;
  notes?: string;
  packageScanned?: boolean;
  priority?: number;
  delivery?: Delivery;
  prescriptions?: Prescription[];
}

export interface Route {
  id: number;
  batchId: number;
  driverId: number;
  name: string;
  status: 'pending' | 'assigned' | 'active' | 'completed';
  startLat?: number;
  startLng?: number;
  startAddress?: string;
  estimatedDuration?: number;
  estimatedDistance?: number;
  polyline?: string;
  optimizedOrder?: number[];
  dispatchedAt?: string;
  completedAt?: string;
  stops?: RouteStop[];
}

export interface Prescription {
  id: number;
  deliveryId: number;
  rxNumber: string;
  patientName?: string;
  status: string;
}

export interface DeliveryProof {
  routeId: number;
  stopId: number;
  signatureData?: string;
  photoUri?: string;
  notes?: string;
  recipientName?: string;
}

export interface LocalProof {
  localId: string;
  routeId: number;
  stopId: number;
  signatureData?: string;
  photoUri?: string;
  notes?: string;
  recipientName?: string;
  savedAt: number;
  uploaded: boolean;
  uploadAttempts: number;
}

export interface SyncStatus {
  pending: number;
  failed: number;
  lastSync?: number;
}
