import re
import sys

def merge_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Block 1
    # <<<<<<< HEAD
    # function getInboundStatusTone ...
    # =======
    # >>>>>>> dev
    # export function CreateInboundOrderModal({
    content = re.sub(
        r"<<<<<<< HEAD\s+function getInboundStatusTone(.*?)=======\s+>>>>>>> dev\s+export function CreateInboundOrderModal\(\{",
        r"function getInboundStatusTone\1export function CreateInboundOrderModal({",
        content,
        flags=re.DOTALL
    )

    # Block 2
    # <<<<<<< HEAD
    #   const [materials, setMaterials] = useState<
    # ...
    # =======
    #   const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);
    # ...
    # >>>>>>> dev
    content = re.sub(
        r"<<<<<<< HEAD\s+const \[materials, setMaterials\] = useState<\s+Array<\{ id: string; description: string; preferredZone\?: string \}>\s+>\(\[\]\);\s+const \[capacityCheckLoading, setCapacityCheckLoading\] = useState\(false\);\s+const \[recommendationLoading, setRecommendationLoading\] = useState\(false\);\s+const \[recommendationError, setRecommendationError\] = useState<string \| null>\(null\);\s+const \[recommendationView, setRecommendationView\] = useState<\"recommended\" \| \"manual\">\(\"recommended\"\);\s+=======\s+const \[warehouseLocations, setWarehouseLocations\] = useState<Location\[\]>\(\[\]\);\s+const \[materials, setMaterials\] = useState<Array<\{ id: string; description: string \}>\>\(\[\]\);\s+const \[supplierHasMaterialLinks, setSupplierHasMaterialLinks\] = useState\(true\);\s+const \[capacityCheckLoading, setCapacityCheckLoading\] = useState\(false\);\s+const \[recommendationLoading, setRecommendationLoading\] = useState\(false\);\s+const \[recommendationError, setRecommendationError\] = useState<string \| null>\(null\);\s+>>>>>>> dev",
        r"""  const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<
    Array<{ id: string; description: string; preferredZone?: string }>
  >([]);
  const [supplierHasMaterialLinks, setSupplierHasMaterialLinks] = useState(true);
  const [capacityCheckLoading, setCapacityCheckLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationView, setRecommendationView] = useState<"recommended" | "manual">("recommended");""",
        content,
        flags=re.MULTILINE
    )

    # Block 3
    # <<<<<<< HEAD
    #       lengthCm: number;
    #       widthCm: number;
    #       heightCm: number;
    # =======
    #       heightCm: number;
    #       lengthCm: number;
    #       widthCm: number;
    # >>>>>>> dev
    content = re.sub(
        r"<<<<<<< HEAD\s+lengthCm: number;\s+widthCm: number;\s+heightCm: number;\s+=======\s+heightCm: number;\s+lengthCm: number;\s+widthCm: number;\s+>>>>>>> dev",
        r"      lengthCm: number;\n      widthCm: number;\n      heightCm: number;",
        content,
        flags=re.MULTILINE
    )

    # Block 4
    # <<<<<<< HEAD
    #   const buildRecommendationRequestItems = () => {
    # ...
    # =======
    #   const hasInfeasibleCapacity = ...
    # ...
    #   const handleConfirmRecommendedLocations = async () => { ... }
    # >>>>>>> dev
    # Wait, instead of regex matching block 4 perfectly which is massive, let's just find HEAD and DEV
    block4_start = content.find("<<<<<<< HEAD\n  const buildRecommendationRequestItems = () => {")
    if block4_start != -1:
        dev_marker = content.find("=======", block4_start)
        dev_end = content.find(">>>>>>> dev\n", dev_marker)
        
        if dev_marker != -1 and dev_end != -1:
            head_part = content[block4_start + 13:dev_marker]
            dev_part = content[dev_marker + 8:dev_end]
            
            # Extract submitInboundOrder and handleConfirmRecommendedLocations from dev_part
            # And extract buildRecommendationRequestItems and hasIncompleteMeasurements and hasInfeasibleCapacity from head_part
            # Actually, I can just write what we need directly.
            
            replacement = head_part + "\n" + """  const submitInboundOrder = async (
    itemsOverride: typeof formData.items = formData.items
  ) => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.supplierId || !formData.warehouseId || !formData.expectedDeliveryDate) {
        setError("Please fill in all required fields.");
        return;
      }

      if (new Date(formData.expectedDeliveryDate) < new Date(formData.orderDate)) {
        setError("Expected delivery date cannot be before order date.");
        return;
      }

      if (itemsOverride.length === 0) {
        setError("Please add at least one item to the order.");
        return;
      }

      const invalidItems = itemsOverride.filter((item) => !item.productId || item.quantityOrdered <= 0);
      if (invalidItems.length > 0) {
        setError("Please ensure all items have a product selected and quantity greater than 0.");
        return;
      }

      const incompletePackageItems = itemsOverride.filter(
        (item) =>
          item.weightKg <= 0 ||
          item.heightCm <= 0 ||
          item.lengthCm <= 0 ||
          item.widthCm <= 0
      );
      if (incompletePackageItems.length > 0) {
        setError(
          "Please enter positive weight, height, length, and width for every item."
        );
        return;
      }

      const invalidDates = itemsOverride.filter(
        (item) =>
          item.manufactureDate &&
          item.expiryDate &&
          new Date(item.expiryDate) <= new Date(item.manufactureDate)
      );
      if (invalidDates.length > 0) {
        setError("Expiry date must be after manufacture date for all items. Please correct the dates.");
        return;
      }

      const invalidManufactureDates = itemsOverride.filter(
        (item) => item.manufactureDate && new Date(item.manufactureDate) > new Date(formData.orderDate)
      );
      if (invalidManufactureDates.length > 0) {
        setError("Manufacture date cannot be later than order date.");
        return;
      }

      const infeasibleItems = itemsOverride.filter((_, idx) => {
        const plan = capacityPlansByItem.get(idx);
        return !!plan && !plan.feasible;
      });
      if (infeasibleItems.length > 0) {
        setError(
          "One or more items do not have enough storage capacity. Adjust quantities or locations before creating this order."
        );
        return;
      }

      const orderNumber = `PO-${Date.now()}`;
      const createdOrder = await ordersApi.create({
        orderNumber,
        orderType: "inbound",
        supplierId: formData.supplierId,
        warehouseId: formData.warehouseId,
        orderDate: formData.orderDate,
        expectedDate: formData.expectedDeliveryDate,
        notes: formData.notes || undefined,
        status: "pending",
        priority: "normal",
      });

      if (!supplierHasMaterialLinks) {
        const uniqueMaterialIds = Array.from(new Set(itemsOverride.map((item) => item.productId).filter(Boolean)));
        if (uniqueMaterialIds.length > 0) {
          await suppliersApi.replaceMaterials(formData.supplierId, uniqueMaterialIds);
        }
      }

      const { orderItemsApi } = await import("@/lib/api/orderItems");
      try {
        await Promise.all(
          itemsOverride.map((item) =>
            orderItemsApi.create(createdOrder.id, {
              materialId: item.productId,
              quantity: item.quantityOrdered,
              locationCode: item.locationCode || undefined,
              weightKg: item.weightKg || undefined,
              heightCm: item.heightCm || undefined,
              lengthCm: item.lengthCm || undefined,
              widthCm: item.widthCm || undefined,
              batchNumber: item.batchNumber || undefined,
              manufactureDate: item.manufactureDate || undefined,
              expiryDate: item.expiryDate || undefined,
            })
          )
        );
      } catch (itemError) {
        logger.error("Failed to create order items:", itemError);
        setError("Order created but failed to add items. Please edit the order to add items.");
      }

      showToast.success(`Inbound order created successfully with ${itemsOverride.length} item(s)!`);
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to create inbound order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecommendedLocations = async () => {
    const confirmedItems = formData.items.map((item, idx) => {
      const recommendation = recommendationsByItem.get(idx);
      return {
        ...item,
        locationCode: recommendation?.recommended_location_code.split(" ")[0] || item.locationCode,
      };
    });

    await submitInboundOrder(confirmedItems);
  };"""
            
            content = content[:block4_start] + replacement + content[dev_end + 12:]

    # Block 5: Lines 519
    content = re.sub(
        r"<<<<<<< HEAD\s+const storageLocations = await locationsApi\.getStorageLocationsByWarehouse\(formData\.warehouseId\);\s+setWarehouseLocations\(storageLocations\);\s+=======\s+const locations = await locationsApi\.getStorageLocationsByWarehouse\(formData\.warehouseId\);\s+setWarehouseLocations\(locations\);\s+>>>>>>> dev",
        r"""        const storageLocations = await locationsApi.getStorageLocationsByWarehouse(formData.warehouseId);
        setWarehouseLocations(storageLocations);""",
        content,
        flags=re.MULTILINE
    )

    # Block 6: Lines 641-746
    # Dev added loadRecommendations logic earlier, but HEAD replaced dev's logic and added handleSubmit.
    # But we moved handleSubmit to block 4 via submitInboundOrder. So we just need loadRecommendations from dev/HEAD.
    block6_start = content.find("<<<<<<< HEAD\n      if (step !== 5 || !formData.warehouseId || formData.items.length === 0 || hasIncompleteMeasurements) {")
    if block6_start != -1:
        dev_marker = content.find("=======", block6_start)
        dev_end = content.find(">>>>>>> dev\n", dev_marker)
        
        if dev_marker != -1 and dev_end != -1:
            # We want HEAD's loadRecommendations logic:
            replacement = """      if (step !== 5 || !formData.warehouseId || formData.items.length === 0 || hasIncompleteMeasurements) {
        setRecommendationLoading(false);
        setRecommendationError(null);
        setRecommendationsByItem(new Map());
        return;
      }

      setRecommendationLoading(true);
      setRecommendationError(null);

      try {
        const response = await AISlottingService.recommendPlacement({
          warehouse_id: formData.warehouseId,
          items: buildRecommendationRequestItems(),
          population_size: 20,
          generations: 50,
          mutation_rate: 0.05,
          top_k_alternatives: 3,
        });

        const recommendationMap = new Map<number, SlottingRecommendationItemResponse>();
        response.recommendations.forEach((recommendation, index) => {
          recommendationMap.set(index, recommendation);
        });
        setRecommendationsByItem(recommendationMap);
      } catch (err) {
        logger.error("Failed to load GA recommendations:", err);
        setRecommendationError(err instanceof Error ? err.message : "Failed to generate recommendations.");
        setRecommendationsByItem(new Map());
      } finally {
        setRecommendationLoading(false);
      }"""
            
            content = content[:block6_start] + replacement + content[dev_end + 12:]

    # Block 7: Lines 761
    content = re.sub(
        r"<<<<<<< HEAD\s+\{\[1, 2, 3, 4, 5\]\.map\(\(s\) => \(\s+=======\s+\{Array\.from\(\{ length: currentStepCount \}, \(_, index\) => index \+ 1\)\.map\(\(s\) => \(\s+>>>>>>> dev",
        r"            {[1, 2, 3, 4, 5].map((s) => (",
        content,
        flags=re.MULTILINE
    )

    # Block 8: Lines 775
    content = re.sub(
        r"<<<<<<< HEAD\s+\{s < 5 && \(\s+<div\s+className=\{clsx\(\"w-16 h-1 mx-2\", step > s \? \"bg-primary\" : \"bg-base-300\"\)\}\s+/>\s+=======\s+\{s < currentStepCount && \(\s+<div className=\{clsx\(\"w-16 h-1 mx-2\", step > s \? \"bg-primary\" : \"bg-base-300\"\)\} />\s+>>>>>>> dev",
        r"""                {s < 5 && (
                  <div
                    className={clsx("w-16 h-1 mx-2", step > s ? "bg-primary" : "bg-base-300")}
                  />""",
        content,
        flags=re.MULTILINE
    )

    # Block 9: Lines 840-1003 (in Add Items step)
    block9_start = content.find("<<<<<<< HEAD\n                    <div className=\"form-control\">\n                      <label className=\"label\">")
    if block9_start != -1:
        dev_marker = content.find("=======", block9_start)
        dev_end = content.find(">>>>>>> dev\n", dev_marker)
        if dev_marker != -1 and dev_end != -1:
            head_part = content[block9_start + 13:dev_marker]
            content = content[:block9_start] + head_part + content[dev_end + 12:]

    # Block 10: Lines 1137-1411 (in step 5 UI)
    block10_start = content.find("<<<<<<< HEAD\n              <button\n                className=\"btn btn-ghost\"")
    if block10_start != -1:
        dev_marker = content.find("=======", block10_start)
        dev_end = content.find(">>>>>>> dev\n", dev_marker)
        if dev_marker != -1 and dev_end != -1:
            # We need the buttons for step 5.
            # Dev had: Back, Select Another Location, Confirm Location
            # HEAD had: Back, Next, ... wait, HEAD had step 4 as package details, and step 5 as GA recommendations.
            # In HEAD, the block 10 conflict was inside `step === 4` from the previous commit, but then HEAD added step 5 and step 4 package details!
            # Let's look closely at what HEAD had.
            head_part = content[block10_start + 13:dev_marker]
            dev_part = content[dev_marker + 8:dev_end]
            
            # The conflict is between step 4 submit buttons and dev's step 5 buttons!
            # HEAD has: Back, Next (to step 4). Wait, the outer block is step 3 in HEAD!
            # Ah, HEAD had `<button className="btn btn-primary" onClick={() => setStep(4)} disabled={isSubmitting || capacityCheckLoading || hasInfeasibleCapacity || formData.items.some((item) => !item.productId || item.quantityOrdered <= 0)}>`
            # Then HEAD had `{step === 4 && ... Package Details ... }`
            # Then HEAD had `{step === 5 && ... GA Recommendations ... }`
            # Where HEAD step 5 ended with a `Create Order` button!
            # Wait, `handleSubmit` was used in HEAD's step 5?
            # Let's just keep HEAD's entire part for block 10 because HEAD completely refactored the steps to add package details.
            
            content = content[:block10_start] + head_part + content[dev_end + 12:]
            
            # WAIT! The step 5 in HEAD uses `onClick={handleSubmit}`!
            # Let's replace `handleSubmit` with `() => submitInboundOrder()`
            content = content.replace("onClick={handleSubmit}", "onClick={() => submitInboundOrder()}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    merge_file("c:/Users/ACER/Documents/GitHub/OptiWMS/frontend/app/admin/orders/inbound/components/InboundOrderModals.tsx")
