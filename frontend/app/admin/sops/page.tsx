"use client";

import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// SOP Categories based on your existing SOPs
export type SOPCategory =
  | "equipment_operation"
  | "cycle_count"
  | "warehouse_operations"
  | "safety"
  | "inspection"
  | "general";

const SOP_CATEGORIES: Record<SOPCategory, string> = {
  equipment_operation: "Equipment Operation",
  cycle_count: "Cycle Count",
  warehouse_operations: "Warehouse Operations",
  safety: "Safety",
  inspection: "Inspection",
  general: "General",
};

// SOP data structure
type SOP = {
  id: string;
  title: string;
  category: SOPCategory;
  content: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  applicableRoles?: string[]; // Worker roles this SOP applies to
  status: "active" | "draft" | "archived";
};

// Mock data - replace with API calls
const mockSOPs: SOP[] = [
  {
    id: "sop-1",
    title: "SOP for Operating Forklift",
    category: "equipment_operation",
    content: `Instruction to use forklifts
Operators must be qualified
* Operating forklifts should only be done by individuals who have been trained properly and contain a license to operate the equipment.
Appropriate clothing must be worn.
* It needs to be ensured that operators wear the appropriate safety work wear; usually consisting of a hard hat, safety shoes and hi-visibility jackets.
* The work wear must be reasonably fitted as any loose clothing can get caught on machinery.
* Don't operate/hold any of the controls when your hands have grease on them; it may cause them to slide off and cause an accident.
Examine Equipment before use
* Operators should do a routine check of the equipment before driving them.  Some things you should check for any faults are brakes, steering, controls, warning devices, mast and tyres.
* If there are any noted damages or problems management should be notified and the forklift should not be operated if it needs to be repaired.
* Always consider the "journey's end" of a load before picking it up.  A convenient position of a load from pick up may not be convenient for stacking.
Starting up the forklift
* For safety purposes it's important for the operator to make use of the steps and hand grabs to seat themselves correctly in the forklift.
* Before starting the forklift it's important to ensure all the equipment's controls are in reach and the seat position and mirrors are adjusted to the operator's needs.
* The operator should not start the forklift until they are correctly seated with their safety belt fastened and all parts of their body are safely inside the confines of the operator's cabin or the forklift.
Consider the surrounding environment

* Whilst operating a forklift you must pay attention and follow any work site rules and guidelines.
* The operator must only drive the equipment in the machinery's designated roadways.
 
* Observe all signs, especially those on maximum permitted floor loadings and clearance heights.
* Be aware of the height of the load, mast and overhead guard of the forklift when entering or exiting buildings.
* Be careful when operating a forklift near the edge of a loading dock or ramp - the forklift can fall over the edge - keep a safe distance from the edge.
* Do not operate on bridge plates, unless they can support the weight of the forklift and load.
Operate at a safe speed
* Never proceed past the speed limit.
* Take corners and any turns slowly to minimize risk of tipping.
* Make any changes in direction or any stops gradually and slowly.

Avoid Hazards
* Steer clear of any bumps or uneven ground surfaces along with slippery conditions.
* Steer clear of loose ground objects which could cause loss of control over the equipment or a load to move around.
* Use the horn when closing in on a corner or doorway/entrance and around people to alert pedestrians or other forklift operators of your whereabouts to avoid any unnecessary collision.
* Keep a safe distance from other trucks in case they move in an unpredictable manner.
* Make sure that you always have enough space to stop safely.

Ensure your load is stable and secure
* Check the loads carefully before moving them for stability and damage.
* It is important to ensure that the load is tilted back with the forks sitting low whilst transporting in order to increase truck stability.
* Check for any overhead objects before lifting or stacking loads.
* Do not lift or move loads that are not safe or stable.
* Make sure loads are correctly stacked and positioned across both forks.
* Stack the load on the pallet or skid safely and correctly.
* Use securing measures such as ropes or bindings if required.

Make sure you have clear visibility
* Operate the forklift in reverse when it improves visibility; except when moving up ramps.
* It is important to make sure you can see the racking clearly in which you are positioning your load.
* If visibility is poor do not continue driving; in some circumstances you may need a lookout helper to assist you.
Forklifts are for Carrying Loads only
* Operators must not let others ride on the equipment unless another seat is fitted safely to the forklift for a second person.
* If a person has to be lifted, use only a securely attached work platform and cage and follow the appropriate operating instructions.
Keep Clear of the Mast
* Do not authorize anyone to stand or walk under the load or forklift machinery - The load can fall causing injury or death.
* Keep hands and feet clear of the cross members of the mast - Serious injury can be caused if the mast is lowered while your hand is on it.

Driving on Ramps
* When driving up ramps move in a forward direction and down ramps in reverse, especially while carrying loads.
* Do not load or unload goods or turn whilst on a ramp.

Ensure the forklift is not Over-loaded
* Do not use the tip of the forks as a lever to raise a heavy load.
* Do not push a load with the tip of the forks.
* Know the capacity of your forklift and any attachments being used and never exceed this capacity.
* An overload can cause the rear tyres to be raised off the ground and may cause the forklift to tip over.

Ensure the Load is evenly distributed
* Do not lift or move a load unless both forks are fully under the load.
* Do not lift a load with one fork. Use pallets and skids that can withstand the weight of the load.
* Do not use damaged, deformed or decayed pallets for holding loads.

Refueling and charging
* A forklift should only be refueled/ charged at specially designated locations.
* Switch off the forklift.
* For IC engine forklifts, no open flame or sparks are permitted, and refueling/ charging should take place in a well-ventilated area.

When the Shift Ends
* After use ensure the forklift is parked in a designated or authorized area.
* Fully lower the forks to the floor and apply the park brake.
* Turn the forklift "off" and remove the key.
* Do not leave a forklift running whilst unattended.`,
    version: "1.0",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
    createdBy: "System Admin",
    applicableRoles: ["forklift_operator"],
    status: "active",
  },
  {
    id: "sop-2",
    title: "SOP for Operating Stacker",
    category: "equipment_operation",
    content: `Instruction to use Stacker
Operators must be qualified
* Operating stacker should only be done by individuals who have been trained properly.
Appropriate clothing must be worn.
* It needs to be ensured that operators wear the appropriate safety work wear; usually consisting of a hard hat, safety shoes and hi-visibility jackets.
* The work wear must be reasonably fitted as any loose clothing can get caught on machinery.
* Don't operate/hold any of the controls when your hands have grease on them; it may cause them to slide off and cause an accident.
Examine Equipment before use
* Operators should do a routine check of the equipment before driving them.  Some things you should check for any faults are brakes, steering, controls and warning devices.
* If there are any noted damages or problems management should be notified and the stacker should not be operated if it needs to be repaired.
* Always consider the "journey's end" of a load before picking it up.  A convenient position of a load from pick up may not be convenient for stacking.
Consider the surrounding environment
* Whilst operating a stacker you must pay attention and follow any work site rules and guidelines.
* The operator must only drive the equipment in the machinery's designated roadways.
* Observe all signs, especially those on maximum permitted floor loadings and clearance heights.
* Be aware of the height of the load when entering or exiting buildings.
* Be careful when operating a stacker near the edge of a loading dock or ramp - the stacker can fall over the edge - keep a safe distance from the edge.
* Do not operate on bridge plates, unless they can support the weight of the stacker and load.
Operate at a safe speed
* Never proceed past the speed limit.
* Take corners and any turns slowly to minimize risk of tipping.
* Make any changes in direction or any stops gradually and slowly.


Avoid Hazards
* Steer clear of any bumps or uneven ground surfaces along with slippery conditions.
* Steer clear of loose ground objects which could cause loss of control over the equipment or a load to move around.
* Use the horn when closing in on a corner or doorway/entrance and around people to alert pedestrians or other stacker operators of your whereabouts to avoid any unnecessary collision.
* Keep a safe distance from other trucks in case they move in an unpredictable manner.
* Make sure that you always have enough space to stop safely.
Ensure your load is stable and secure
* Check the loads carefully before moving them for stability and damage.
* Check for any overhead objects before lifting or stacking loads.
* Do not lift or move loads that are not safe or stable.
* Make sure loads are correctly stacked and positioned across both forks.
* Stack the load on the pallet or skid safely and correctly.
* Use securing measures such as ropes or bindings if required.

Make sure you have clear visibility
* Operate the Stacker in reverse when it improves visibility; except when moving up ramps.
* It is important to make sure you can see the racking clearly in which you are positioning your load.
* If visibility is poor do not continue driving; in some circumstances you may need a lookout helper to assist you.

Stacker are for Carrying Loads only
* If a person has to be lifted, use only a securely attached work platform and cage and follow the appropriate operating instructions.
Keep Clear of the Mast
* Do not authorize anyone to stand or walk under the load or Stacker - The load can fall causing injury or death.
* Keep hands and feet clear of the cross members of the mast - Serious injury can be caused if the mast is lowered while your hand is on it.


Stackers are for Carrying Loads only
* It is not allowed to carry people on stacker.
Driving on Ramps
* When driving up ramps move in a forward direction and down ramps in reverse, especially while carrying loads.
* Do not load or unload goods or turn whilst on a ramp.

Ensure the powered pallet truck is not Over-loaded
* Know the capacity of your stacker and any attachments being used and never exceed this capacity.
* An overload can cause the rear tyres to be raised off the ground and may cause the stacker to tip over.

Ensure the Load is evenly distributed
* Do not lift or move a load unless both forks are fully under the load.
* Do not lift a load with one fork. Use pallets and skids that can withstand the weight of the load.
* Do not use damaged, deformed or decayed pallets for holding loads.

Refueling and charging
* A powered pallet truck should only be charged at specially designated locations.
* Switch off the powered pallet truck.
* For IC engine stacker, no open flame or sparks are permitted, and refueling/ charging should take place in a well-ventilated area.

When the Shift Ends
* After use ensure the powered pallet trucks is parked in a designated or authorized area.
* Fully lower the forks and park.
* Turn the stacker "off" and remove the key.
* Do not leave the powered pallet trucks whilst unattended.`,
    version: "1.0",
    createdAt: "2024-01-16",
    updatedAt: "2024-01-16",
    createdBy: "System Admin",
    applicableRoles: ["stacker_operator"],
    status: "active",
  },
  {
    id: "sop-3",
    title: "SOP for Operating Powered Pallet Truck",
    category: "equipment_operation",
    content: `Instruction to use powered pallet trucks
Operators must be qualified
* Operating powered pallet truck should only be done by individuals who have been trained properly.
Appropriate clothing must be worn.
* It needs to be ensured that operators wear the appropriate safety work wear; usually consisting of a hard hat, safety shoes and hi-visibility jackets.
* The work wear must be reasonably fitted as any loose clothing can get caught on machinery.
* Don't operate/hold any of the controls when your hands have grease on them; it may cause them to slide off and cause an accident.
Examine Equipment before use
* Operators should do a routine check of the equipment before driving them.  Some things you should check for any faults are brakes, steering, controls and warning devices.
* If there are any noted damages or problems management should be notified and the powered pallet truck should not be operated if it needs to be repaired.
* Always consider the "journey's end" of a load before picking it up.  A convenient position of a load from pick up may not be convenient for stacking.
Consider the surrounding environment
* Whilst operating a powered pallet truck you must pay attention and follow any work site rules and guidelines.
* The operator must only drive the equipment in the machinery's designated roadways.
* Observe all signs, especially those on maximum permitted floor loadings and clearance heights.
* Be aware of the height of the load when entering or exiting buildings.
* Be careful when operating a powered pallet truck near the edge of a loading dock or ramp - the powered pallet truck can fall over the edge - keep a safe distance from the edge.
* Do not operate on bridge plates, unless they can support the weight of the powered pallet truck and load.
Operate at a safe speed
* Never proceed past the speed limit.
* Take corners and any turns slowly to minimize risk of tipping.
* Make any changes in direction or any stops gradually and slowly.

Avoid Hazards
* Steer clear of any bumps or uneven ground surfaces along with slippery conditions.
* Steer clear of loose ground objects which could cause loss of control over the equipment or a load to move around.
* Use the horn when closing in on a corner or doorway/entrance and around people to alert pedestrians or other forklift operators of your whereabouts to avoid any unnecessary collision.
* Keep a safe distance from other trucks in case they move in an unpredictable manner.
* Make sure that you always have enough space to stop safely.
Ensure your load is stable and secure
* Check the loads carefully before moving them for stability and damage.
* Check for any overhead objects before lifting or stacking loads.
* Do not lift or move loads that are not safe or stable.
* Make sure loads are correctly stacked and positioned across both forks.
* Stack the load on the pallet or skid safely and correctly.
* Use securing measures such as ropes or bindings if required.
Make sure you have clear visibility
* Operate the powered pallet truck in reverse when it improves visibility; except when moving up ramps.
* If visibility is poor do not continue driving; in some circumstances you may need a lookout helper to assist you.
Powered pallet truck are for Carrying Loads only
* It is not allowed to carry people on powered pallet truck.
Driving on Ramps
* When driving up ramps move in a forward direction and down ramps in reverse, especially while carrying loads.
* Do not load or unload goods or turn whilst on a ramp.

Ensure the powered pallet truck is not Over-loaded
* Know the capacity of your powered pallet truck and any attachments being used and never exceed this capacity.
* An overload can cause the rear tyres to be raised off the ground and may cause the forklift to tip over.

Ensure the Load is evenly distributed
* Do not lift or move a load unless both forks are fully under the load.
* Do not lift a load with one fork. Use pallets and skids that can withstand the weight of the load.
* Do not use damaged, deformed or decayed pallets for holding loads.

Refueling and charging
* A powered pallet truck should only be charged at specially designated locations.
* Switch off the powered pallet truck.
* For IC engine forklifts, no open flame or sparks are permitted, and refueling/ charging should take place in a well-ventilated area.

When the Shift Ends
* After use ensure the powered pallet trucks is parked in a designated or authorized area.
* Fully lower the forks and park.
* Turn the powered pallet trucks "off" and remove the key.
* Do not leave the powered pallet trucks whilst unattended.`,
    version: "1.0",
    createdAt: "2024-01-17",
    updatedAt: "2024-01-17",
    createdBy: "System Admin",
    applicableRoles: ["powered_pallet_truck_operator"],
    status: "active",
  },
  {
    id: "sop-4",
    title: "SOP for Unloading",
    category: "warehouse_operations",
    content: `Unloading materials
* Wearing safety shoes and hi-visibility jacket is must
* Unloading crew should wear appropriate PPEs according to materials to be unloaded.
o Heavy material – gloves/ helmets 
o Material with dust – masks/goggles
o Hazardous chemical – gloves/ masks/ goggles
* Appropriate equipment should be used according to materials to be unloaded.
o Drums - Drum handler/ forklift
o Heavy material – Forklift/ Powered pallet trucks
* Ensure materials stored in vehicle are in good condition.
* For raw materials, maximum accepted weight on a pallet is 1500kg.
* For packing materials, maximum accepted weight on a pallet is 1000kg.
* Stack different materials on separate pallets.
* Material should be stacked according to standards.
o Stacking standards (stacking height data sheet/ printed on packages)
* Once stacking is done, material should be wrapped with tape or strapping or stretch films.`,
    version: "1.0",
    createdAt: "2024-01-18",
    updatedAt: "2024-01-18",
    createdBy: "System Admin",
    applicableRoles: ["unloading_worker"],
    status: "active",
  },
  {
    id: "sop-5",
    title: "SOP for Cycle Counts",
    category: "cycle_count",
    content: `Conducting cycle counts
1. Cycle counts should be conducted quarterly. 
2. In charge of raw material, packing materials and engineering stores run and downloads stock reports from the SAP system and prepare material data sheet based on material category.
3. In charges prepare teams according to the material categories and assign people to the teams accordingly. 
4. In charges provide relevant material data sheets to teams.
5. Teams should count and record physical quantities of relevant materials on material data sheet
6. All the physically counted quantities are entered into excel sheet and get variances with system quantities. 
7. Materials with variances should be re-counted to check whether anything has been missed. 
8. If material variances cannot be resolved at the moment, material should be moved to cycle count shortage location (2047) through the system till the issue is solved.`,
    version: "1.0",
    createdAt: "2024-01-20",
    updatedAt: "2024-01-20",
    createdBy: "System Admin",
    applicableRoles: ["cycle_count_worker", "warehouse_safekeeping_worker"],
    status: "active",
  },
  {
    id: "sop-6",
    title: "SOP for Warehouse Safekeeping",
    category: "warehouse_operations",
    content: `Warehouse Safekeeping Procedure

1.	Carry out inspection once in three months as per check list.  (F 15.4.1)
2.	Enter observations and maintain records. 
3.	Identify weakness and take steps to improve.`,
    version: "1.0",
    createdAt: "2024-01-21",
    updatedAt: "2024-01-21",
    createdBy: "System Admin",
    applicableRoles: ["warehouse_safekeeping_worker"],
    status: "active",
  },
  {
    id: "sop-7",
    title: "SOP for Pallet Purchasing",
    category: "warehouse_operations",
    content: `Instruction to Purchase Empty pallets
1. Engineering store takes quotation from suppliers, evaluate suppliers/quotation and selects a supplier annually. 
2. Logistics executive receives pallet requirements from respective plants (Material warehouse/Diva plants).
3. Logistics executive checks in & out of empty pallets and reconcile in & out quantities. 
4. If there is quantity to be received from plants (FGWH/JKL), check whether the plants can release the required quantity immediately. 
5. If plants are unable to release the required quantity, Assistant manager or Head of logistics should be informed regarding the requirement and get approval for purchasing new pallets.`,
    version: "1.0",
    createdAt: "2024-01-22",
    updatedAt: "2024-01-22",
    createdBy: "System Admin",
    applicableRoles: [],
    status: "active",
  },
  {
    id: "sop-8",
    title: "SOP Vehicle Inspection",
    category: "inspection",
    content: `Vehicle Inspection Record

Date: ...................................
Name of Transporter: .
Supplier Name: ............................................................................................................................
Dispatch / GRN Number: ............................................................................................................
Vehicle Number: ...........................................................................................................................
Evaluation

Condition
Yes 
No 
1
Good General Cleanliness (Body / Roof / Floor)


2
Low Dust Level Inside the Vehicle  


3
No Oil and Grease Patches


4
No Insect / Pest Infestation


5
Do not  Susceptible to Weather Damage


6
No Adverse Odour  


7
No Oil Spillages 


8
Good Physical Condition of Vehicle 


9
Vehicle is Fully Covered 


10
Other 


Remarks:

. ...                                        

Evaluation done by: .
  




				
		



Prepared & Reviewed By: 
Management Representative
Approved By:
Head Of Quality

Doc No:
HEMAS/QMS/WH/VI/01
Date Issued:
2018-02-20
Revision No./Date:
00 / 0000 – 00 – 00
Page No:
Page 1 of 1`,
    version: "1.0",
    createdAt: "2024-01-23",
    updatedAt: "2024-01-23",
    createdBy: "System Admin",
    applicableRoles: ["vehicle_inspector"],
    status: "active",
  },
];

const statusConfig = {
  active: { label: "Active", class: "badge-success" },
  draft: { label: "Draft", class: "badge-warning" },
  archived: { label: "Archived", class: "badge-error" },
};

export default function SOPsPage() {
  const { hasPermission, role } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SOPCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SOP["status"]>(
    "all"
  );

  const canCreate = hasPermission(ADMIN_ROUTES.SOPS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.SOPS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.SOPS, "delete");

  const summary = {
    totalSOPs: mockSOPs.length,
    activeSOPs: mockSOPs.filter((s) => s.status === "active").length,
    draftSOPs: mockSOPs.filter((s) => s.status === "draft").length,
    archivedSOPs: mockSOPs.filter((s) => s.status === "archived").length,
  };

  const filteredSOPs = mockSOPs.filter((sop) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      sop.title.toLowerCase().includes(query) ||
      sop.content.toLowerCase().includes(query) ||
      sop.category.toLowerCase().includes(query);
    const matchesCategory =
      categoryFilter === "all" || sop.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || sop.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Total SOPs",
      value: summary.totalSOPs,
      icon: "description",
      color: "primary" as const,
    },
    {
      label: "Active SOPs",
      value: summary.activeSOPs,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Draft SOPs",
      value: summary.draftSOPs,
      icon: "edit",
      color: "warning" as const,
    },
    {
      label: "Archived SOPs",
      value: summary.archivedSOPs,
      icon: "archive",
      color: "error" as const,
    },
  ];

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (sop: SOP) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSOP(sop);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {sop.title}
        </button>
      ),
      sortable: true,
    },
    {
      key: "category",
      label: "Category",
      render: (sop: SOP) => (
        <span className="badge badge-outline">
          {SOP_CATEGORIES[sop.category]}
        </span>
      ),
      sortable: true,
    },
    {
      key: "version",
      label: "Version",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (sop: SOP) => {
        const status = statusConfig[sop.status];
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "updatedAt",
      label: "Last Updated",
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "createdBy",
      label: "Created By",
      className: "text-base-content/70",
    },
  ];

  // Function to download SOP as markdown file
  const downloadSOP = (sop: SOP) => {
    const content = `# ${sop.title}

**Category:** ${SOP_CATEGORIES[sop.category]}  
**Version:** ${sop.version}  
**Status:** ${sop.status}  
**Last Updated:** ${sop.updatedAt}  
**Created:** ${sop.createdAt}  
**Created By:** ${sop.createdBy}

---

${sop.content}
`;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_v${
      sop.version
    }.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderActions = (sop: SOP) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSOP(sop);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </button>
        </li>
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadSOP(sop);
            }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download SOP
          </button>
        </li>
        {canEdit && (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingSOP(sop);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit SOP
            </button>
          </li>
        )}
        {canDelete && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSOP(sop);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete SOP
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Standard Operating Procedures
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage and maintain Standard Operating Procedures for warehouse
            operations
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search SOPs..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setCategoryFilter("all")}>
                  All Categories
                </button>
              </li>
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <li key={key}>
                  <button onClick={() => setCategoryFilter(key as SOPCategory)}>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_alt</span>
              <span>Status</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setStatusFilter("all")}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("active")}>
                  Active
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("draft")}>Draft</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("archived")}>
                  Archived
                </button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add SOP</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* SOPs Table */}
      <DataTable
        data={filteredSOPs}
        columns={columns}
        keyExtractor={(sop) => sop.id}
        onRowClick={(sop) => {
          setSelectedSOP(sop);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No SOPs found"
      />

      {/* Create SOP Modal */}
      <CreateSOPModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Edit SOP Modal */}
      {editingSOP && (
        <EditSOPModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingSOP(null);
          }}
          sop={editingSOP}
        />
      )}

      {/* SOP Detail Modal */}
      {selectedSOP && (
        <SOPDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSOP(null);
          }}
          sop={selectedSOP}
          onEdit={(sop) => {
            setShowDetailModal(false);
            setSelectedSOP(null);
            setEditingSOP(sop);
            setShowEditModal(true);
          }}
          canEdit={canEdit}
        />
      )}

      {/* Delete SOP Modal */}
      {selectedSOP && (
        <DeleteSOPModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedSOP(null);
          }}
          onConfirm={() => {
            // TODO: API call to delete SOP
            console.log("Deleting SOP:", selectedSOP.id);
            setShowDeleteModal(false);
            setSelectedSOP(null);
          }}
          sop={selectedSOP}
        />
      )}
    </div>
  );
}

// Create SOP Modal Component
function CreateSOPModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    category: "general" as SOPCategory,
    content: "",
    version: "1.0",
    status: "draft" as SOP["status"],
    applicableRoles: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create SOP
    console.log("Creating SOP:", formData);
    onClose();
    setFormData({
      title: "",
      category: "general",
      content: "",
      version: "1.0",
      status: "draft",
      applicableRoles: [],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add SOP" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Title *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
            placeholder="e.g., SOP for Operating Forklift"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as SOPCategory,
                })
              }
              required
            >
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Version *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
              required
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as SOP["status"],
              })
            }
            required
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Content *</span>
            <span className="label-text-alt">Markdown supported</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-80 font-mono text-sm"
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            required
            placeholder={`# SOP Title

## Section 1

Use markdown formatting:

- **Bold text** with **
- *Italic text* with *
- Bullet points with -
- Numbered lists with 1. 2. 3.

### Subsection

\`\`\`code blocks\`\`\`

> Blockquotes for important notes`}
          />
          <label className="label">
            <span className="label-text-alt">
              Supports markdown: **bold**, *italic*, lists, headings, code
              blocks, and more. Content will be rendered with proper formatting
              when viewed.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create SOP
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit SOP Modal Component (similar to Create, but with existing data)
function EditSOPModal({
  isOpen,
  onClose,
  sop,
}: {
  isOpen: boolean;
  onClose: () => void;
  sop: SOP;
}) {
  const [formData, setFormData] = useState({
    title: sop.title,
    category: sop.category,
    content: sop.content,
    version: sop.version,
    status: sop.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update SOP
    console.log("Updating SOP:", sop.id, formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit SOP" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Title *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as SOPCategory,
                })
              }
              required
            >
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Version *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Content *</span>
            <span className="label-text-alt">Markdown supported</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-80 font-mono text-sm"
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder={`# SOP Title

## Section 1

Use markdown formatting:

- **Bold text** with **
- *Italic text* with *
- Bullet points with -
- Numbered lists with 1. 2. 3.

### Subsection

\`\`\`code blocks\`\`\`

> Blockquotes for important notes`}
            required
          />
          <label className="label">
            <span className="label-text-alt">
              Supports markdown: **bold**, *italic*, lists, headings, code
              blocks, and more. Content will be rendered with proper formatting
              when viewed.
            </span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as SOP["status"],
              })
            }
            required
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// SOP Detail Modal Component
function SOPDetailModal({
  isOpen,
  onClose,
  sop,
  onEdit,
  canEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  sop: SOP;
  onEdit: (sop: SOP) => void;
  canEdit: boolean;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={sop.title} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Category</label>
            <p>
              <span className="badge badge-outline">
                {SOP_CATEGORIES[sop.category]}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Version</label>
            <p className="font-semibold">{sop.version}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusConfig[sop.status].class}`}>
                {statusConfig[sop.status].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Updated</label>
            <p className="font-semibold">{sop.updatedAt}</p>
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="text-sm text-base-content/60 mb-2 block">
            Content
          </label>
          <div className="bg-base-200 rounded-lg p-6 max-h-[600px] overflow-y-auto text-base-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1
                    className="text-2xl font-bold mb-4 mt-6 first:mt-0"
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold mb-3 mt-5" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-lg font-semibold mb-2 mt-4" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="mb-3 leading-relaxed" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc mb-3 space-y-2 ml-6" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal mb-3 space-y-2 ml-6" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="mb-1 leading-relaxed" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-bold text-base-content" {...props} />
                ),
                em: ({ node, ...props }) => (
                  <em className="italic" {...props} />
                ),
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code
                      className="bg-base-300 px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    />
                  ) : (
                    <code
                      className="block bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3"
                      {...props}
                    />
                  ),
                pre: ({ node, ...props }) => (
                  <pre
                    className="bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3"
                    {...props}
                  />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className="border-l-4 border-primary pl-4 italic my-3 text-base-content/70"
                    {...props}
                  />
                ),
                hr: ({ node, ...props }) => (
                  <hr className="my-4 border-base-300" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table
                      className="min-w-full border-collapse border border-base-300"
                      {...props}
                    />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-base-300" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th
                    className="border border-base-300 px-4 py-2 text-left font-semibold"
                    {...props}
                  />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-base-300 px-4 py-2" {...props} />
                ),
              }}
            >
              {sop.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            className="btn btn-ghost"
            onClick={() => {
              const content = `# ${sop.title}

**Category:** ${SOP_CATEGORIES[sop.category]}  
**Version:** ${sop.version}  
**Status:** ${sop.status}  
**Last Updated:** ${sop.updatedAt}  
**Created:** ${sop.createdAt}  
**Created By:** ${sop.createdBy}

---

${sop.content}
`;
              const blob = new Blob([content], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_v${
                sop.version
              }.md`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <span className="material-symbols-outlined">download</span>
            Download
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(sop)}>
              Edit SOP
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Delete SOP Modal Component
function DeleteSOPModal({
  isOpen,
  onClose,
  onConfirm,
  sop,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sop: SOP;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete SOP" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{sop.title}</strong>. This will
              permanently remove this SOP from the system.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Title:</strong> {sop.title}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Category:</strong> {SOP_CATEGORIES[sop.category]}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Version:</strong> {sop.version}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete SOP
          </button>
        </div>
      </div>
    </Modal>
  );
}
