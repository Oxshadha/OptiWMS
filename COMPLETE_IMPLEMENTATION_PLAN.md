# Complete Implementation Plan - Receiving & Putaway

## Goal
Complete end-to-end receiving and putaway process with:
1. Standardized location format: **C-02-05-3-B** (AREA-ROW-BAY-LEVEL-POS)
2. LPN generation and storage in database
3. Bulk assignment updates BOTH MaterialDefaultLocation AND inventory
4. Complete receiving → putaway workflow

## Implementation Steps

### Phase 1: Database & Backend Foundation ✅
- [x] Create LPN table
- [x] Add LPN to inventory table
- [x] Standardize location format (migration)
- [ ] Create LPN generation service
- [ ] Update bulk assignment to update inventory

### Phase 2: Location Format Standardization
- [ ] Update validation to ONLY accept C-02-05-3-B
- [ ] Update all location creation/parsing code
- [ ] Update frontend validation
- [ ] Test location format enforcement

### Phase 3: LPN Management
- [ ] Create LPNService for generation
- [ ] Auto-generate LPN on putaway
- [ ] Store LPN in database
- [ ] Link LPN to inventory records

### Phase 4: Bulk Assignment Enhancement
- [ ] Update MaterialDefaultLocationService to also update inventory
- [ ] Handle existing inventory (update vs create)
- [ ] Update frontend bulk assignment
- [ ] Test bulk assignment flow

### Phase 5: Complete Receiving & Putaway
- [ ] Receiving creates inventory with quantity
- [ ] Putaway assigns location_code and LPN
- [ ] Update warehouse layout to show items
- [ ] End-to-end testing

## Location Format Standard: C-02-05-3-B

**Format**: `AREA-ROW-BAY-LEVEL-POS`
- **AREA**: Single letter (A-Z) - Storage area
- **ROW**: 2 digits (01-99) - Row number
- **BAY**: 2 digits (01-99) - Bay number  
- **LEVEL**: 1-2 digits (1-10) - Level/shelf
- **POS**: Single letter (A-Z) - Bin position

**Examples**:
- `C-02-05-3-B` ✅ Valid
- `A-01-01-1-A` ✅ Valid
- `ST-WH-001-01-001-1-A` ❌ Invalid (will be converted)

## LPN Format: LPN-XXXX

**Format**: `LPN-XXXX` where XXXX is 4-8 alphanumeric
- **Examples**: `LPN-1234`, `LPN-ABC123`, `LPN-PALLET01`
- **Generation**: Auto-generated sequential or UUID-based
- **Storage**: Stored in `lpns` table and linked to `inventory.lpn_code`
