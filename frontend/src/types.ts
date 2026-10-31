export type Role = "CUSTOMER" | "OPERATOR";
export type VehicleCategory = "BIKE" | "CAR" | "EV";
export type SlotStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BLOCKED" | "STALE";
export type DataSource = "LIVE_IOT" | "OPERATOR_UPDATED" | "SIMULATED_DEMO" | "UNKNOWN_STALE";

export interface Vehicle {
  id: string;
  nickname: string;
  makeModel: string;
  color: string;
  plateNumber: string;
  category: VehicleCategory;
  ocrSource: "MANUAL" | "SIMULATED_OCR";
}

export interface Destination {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  publicParkingNote: string;
  isDestinationOnly: boolean;
}

export interface ParkingSlot {
  id: string;
  facilityId: string;
  code: string;
  floor: string;
  zone: string;
  slotType: VehicleCategory;
  hasEvCharger: boolean;
  evChargerWorking: boolean;
  isAccessible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  status: SlotStatus;
  dataSource: DataSource;
  lastUpdated: string;
  aiConfidence?: number;
  frameRef?: string;
}

export interface LayoutElement {
  id: string;
  facilityId: string;
  elementType: "ENTRANCE" | "EXIT" | "AISLE" | "OBSTACLE";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Facility {
  id: string;
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  operatingHours: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  allowStandardCarInEv: boolean;
  allowPayAtExit: boolean;
  layoutVersion: number;
  rateBikeHr: number;
  rateCarHr: number;
  rateEvHr: number;
  evChargingFee: number;
  gracePeriodMins: number;
  dailyCap: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  facilityId: string;
  facilityName: string;
  slotId: string;
  snapshotSlotCode: string;
  vehicleId: string;
  snapshotPlate: string;
  snapshotVehicleType: VehicleCategory;
  snapshotHourlyRate: number;
  bookingType: "ADVANCE" | "WALK_IN";
  startTime: string;
  durationHours: number;
  totalAmount: number;
  paymentMode: "PREPAID" | "PAY_AT_EXIT";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED" | "FAILED";
  status: "HOLD" | "CONFIRMED" | "ACTIVE_SESSION" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  holdExpiresAt?: number;
  entryTime?: string;
  exitTime?: string;
}

export interface PaymentRecord {
  id: string;
  bookingRef: string;
  idempotencyKey: string;
  amount: number;
  method: "SIMULATED_UPI" | "SIMULATED_CARD" | "SIMULATED_NETBANKING";
  status: "SUCCESS" | "FAILED" | "REFUNDED";
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}
