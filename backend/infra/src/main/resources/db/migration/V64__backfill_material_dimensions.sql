-- V64: Backfill material physical dimensions from generated product_dimensions.csv
-- Maps units_per_pallet -> pallet_spaces; heuristic fill for legacy numeric material codes

UPDATE materials SET
    length_cm = 16.19, width_cm = 7.19, height_cm = 5.58,
    weight_kg = 0.12, volume_cm3 = 649.55,
    pallet_spaces = 78, units_per_pallet = 78,
    updated_at = NOW()
WHERE material_code = 'FG001';
UPDATE materials SET
    length_cm = 17.8, width_cm = 8.81, height_cm = 5.36,
    weight_kg = 0.06, volume_cm3 = 840.54,
    pallet_spaces = 68, units_per_pallet = 68,
    updated_at = NOW()
WHERE material_code = 'FG002';
UPDATE materials SET
    length_cm = 13.6, width_cm = 6.85, height_cm = 5.78,
    weight_kg = 0.11, volume_cm3 = 538.46,
    pallet_spaces = 96, units_per_pallet = 96,
    updated_at = NOW()
WHERE material_code = 'FG003';
UPDATE materials SET
    length_cm = 13.55, width_cm = 6.14, height_cm = 4.66,
    weight_kg = 0.06, volume_cm3 = 387.7,
    pallet_spaces = 134, units_per_pallet = 134,
    updated_at = NOW()
WHERE material_code = 'FG004';
UPDATE materials SET
    length_cm = 16.62, width_cm = 8.16, height_cm = 5.27,
    weight_kg = 0.09, volume_cm3 = 714.71,
    pallet_spaces = 66, units_per_pallet = 66,
    updated_at = NOW()
WHERE material_code = 'FG005';
UPDATE materials SET
    length_cm = 17.14, width_cm = 8.89, height_cm = 3.58,
    weight_kg = 0.1, volume_cm3 = 545.5,
    pallet_spaces = 147, units_per_pallet = 147,
    updated_at = NOW()
WHERE material_code = 'FG006';
UPDATE materials SET
    length_cm = 10.35, width_cm = 5.77, height_cm = 5.05,
    weight_kg = 0.12, volume_cm3 = 301.58,
    pallet_spaces = 92, units_per_pallet = 92,
    updated_at = NOW()
WHERE material_code = 'FG007';
UPDATE materials SET
    length_cm = 12.61, width_cm = 6.85, height_cm = 4.41,
    weight_kg = 0.07, volume_cm3 = 380.93,
    pallet_spaces = 147, units_per_pallet = 147,
    updated_at = NOW()
WHERE material_code = 'FG008';
UPDATE materials SET
    length_cm = 11.04, width_cm = 7.38, height_cm = 3.68,
    weight_kg = 0.12, volume_cm3 = 299.83,
    pallet_spaces = 144, units_per_pallet = 144,
    updated_at = NOW()
WHERE material_code = 'FG009';
UPDATE materials SET
    length_cm = 16.66, width_cm = 8.5, height_cm = 3.94,
    weight_kg = 0.13, volume_cm3 = 557.94,
    pallet_spaces = 99, units_per_pallet = 99,
    updated_at = NOW()
WHERE material_code = 'FG010';
UPDATE materials SET
    length_cm = 16.44, width_cm = 6.94, height_cm = 3.86,
    weight_kg = 0.12, volume_cm3 = 440.4,
    pallet_spaces = 117, units_per_pallet = 117,
    updated_at = NOW()
WHERE material_code = 'FG011';
UPDATE materials SET
    length_cm = 11.6, width_cm = 5.04, height_cm = 5.36,
    weight_kg = 0.12, volume_cm3 = 313.37,
    pallet_spaces = 72, units_per_pallet = 72,
    updated_at = NOW()
WHERE material_code = 'FG012';
UPDATE materials SET
    length_cm = 15.64, width_cm = 8.9, height_cm = 4.38,
    weight_kg = 0.11, volume_cm3 = 609.68,
    pallet_spaces = 63, units_per_pallet = 63,
    updated_at = NOW()
WHERE material_code = 'FG013';
UPDATE materials SET
    length_cm = 10.92, width_cm = 8.34, height_cm = 4.41,
    weight_kg = 0.11, volume_cm3 = 401.63,
    pallet_spaces = 72, units_per_pallet = 72,
    updated_at = NOW()
WHERE material_code = 'FG014';
UPDATE materials SET
    length_cm = 16.12, width_cm = 8.17, height_cm = 4.66,
    weight_kg = 0.11, volume_cm3 = 613.72,
    pallet_spaces = 131, units_per_pallet = 131,
    updated_at = NOW()
WHERE material_code = 'FG015';
UPDATE materials SET
    length_cm = 6.49, width_cm = 7.18, height_cm = 15.0,
    weight_kg = 0.25, volume_cm3 = 698.97,
    pallet_spaces = 64, units_per_pallet = 64,
    updated_at = NOW()
WHERE material_code = 'FG016';
UPDATE materials SET
    length_cm = 19.65, width_cm = 6.17, height_cm = 12.82,
    weight_kg = 0.2, volume_cm3 = 1554.3,
    pallet_spaces = 113, units_per_pallet = 113,
    updated_at = NOW()
WHERE material_code = 'FG017';
UPDATE materials SET
    length_cm = 16.59, width_cm = 7.79, height_cm = 22.97,
    weight_kg = 0.36, volume_cm3 = 2968.55,
    pallet_spaces = 63, units_per_pallet = 63,
    updated_at = NOW()
WHERE material_code = 'FG018';
UPDATE materials SET
    length_cm = 12.5, width_cm = 9.07, height_cm = 14.34,
    weight_kg = 0.09, volume_cm3 = 1625.8,
    pallet_spaces = 48, units_per_pallet = 48,
    updated_at = NOW()
WHERE material_code = 'FG019';
UPDATE materials SET
    length_cm = 17.56, width_cm = 7.31, height_cm = 14.26,
    weight_kg = 0.29, volume_cm3 = 1830.46,
    pallet_spaces = 47, units_per_pallet = 47,
    updated_at = NOW()
WHERE material_code = 'FG020';
UPDATE materials SET
    length_cm = 8.44, width_cm = 8.48, height_cm = 18.25,
    weight_kg = 0.24, volume_cm3 = 1306.17,
    pallet_spaces = 59, units_per_pallet = 59,
    updated_at = NOW()
WHERE material_code = 'FG021';
UPDATE materials SET
    length_cm = 16.08, width_cm = 6.81, height_cm = 13.23,
    weight_kg = 0.13, volume_cm3 = 1448.75,
    pallet_spaces = 64, units_per_pallet = 64,
    updated_at = NOW()
WHERE material_code = 'FG022';
UPDATE materials SET
    length_cm = 21.39, width_cm = 9.54, height_cm = 21.8,
    weight_kg = 0.19, volume_cm3 = 4448.52,
    pallet_spaces = 101, units_per_pallet = 101,
    updated_at = NOW()
WHERE material_code = 'FG023';
UPDATE materials SET
    length_cm = 18.46, width_cm = 8.58, height_cm = 18.29,
    weight_kg = 0.19, volume_cm3 = 2896.89,
    pallet_spaces = 117, units_per_pallet = 117,
    updated_at = NOW()
WHERE material_code = 'FG024';
UPDATE materials SET
    length_cm = 7.54, width_cm = 9.51, height_cm = 18.38,
    weight_kg = 0.16, volume_cm3 = 1317.95,
    pallet_spaces = 97, units_per_pallet = 97,
    updated_at = NOW()
WHERE material_code = 'FG025';
UPDATE materials SET
    length_cm = 15.27, width_cm = 5.88, height_cm = 23.99,
    weight_kg = 0.4, volume_cm3 = 2154.0,
    pallet_spaces = 64, units_per_pallet = 64,
    updated_at = NOW()
WHERE material_code = 'FG026';
UPDATE materials SET
    length_cm = 17.51, width_cm = 7.16, height_cm = 20.78,
    weight_kg = 0.33, volume_cm3 = 2605.22,
    pallet_spaces = 47, units_per_pallet = 47,
    updated_at = NOW()
WHERE material_code = 'FG027';
UPDATE materials SET
    length_cm = 7.35, width_cm = 7.08, height_cm = 12.58,
    weight_kg = 0.29, volume_cm3 = 654.64,
    pallet_spaces = 91, units_per_pallet = 91,
    updated_at = NOW()
WHERE material_code = 'FG028';
UPDATE materials SET
    length_cm = 11.28, width_cm = 5.72, height_cm = 13.45,
    weight_kg = 0.33, volume_cm3 = 867.82,
    pallet_spaces = 103, units_per_pallet = 103,
    updated_at = NOW()
WHERE material_code = 'FG029';
UPDATE materials SET
    length_cm = 20.8, width_cm = 7.91, height_cm = 16.86,
    weight_kg = 0.33, volume_cm3 = 2773.94,
    pallet_spaces = 53, units_per_pallet = 53,
    updated_at = NOW()
WHERE material_code = 'FG030';
UPDATE materials SET
    length_cm = 6.36, width_cm = 9.79, height_cm = 18.75,
    weight_kg = 0.41, volume_cm3 = 1167.46,
    pallet_spaces = 45, units_per_pallet = 45,
    updated_at = NOW()
WHERE material_code = 'FG031';
UPDATE materials SET
    length_cm = 13.79, width_cm = 7.45, height_cm = 25.13,
    weight_kg = 0.32, volume_cm3 = 2581.74,
    pallet_spaces = 46, units_per_pallet = 46,
    updated_at = NOW()
WHERE material_code = 'FG032';
UPDATE materials SET
    length_cm = 13.58, width_cm = 6.33, height_cm = 16.64,
    weight_kg = 0.3, volume_cm3 = 1430.4,
    pallet_spaces = 107, units_per_pallet = 107,
    updated_at = NOW()
WHERE material_code = 'FG033';
UPDATE materials SET
    length_cm = 8.15, width_cm = 10.96, height_cm = 28.44,
    weight_kg = 0.33, volume_cm3 = 2540.37,
    pallet_spaces = 60, units_per_pallet = 60,
    updated_at = NOW()
WHERE material_code = 'FG034';
UPDATE materials SET
    length_cm = 11.88, width_cm = 6.65, height_cm = 25.08,
    weight_kg = 0.45, volume_cm3 = 1981.37,
    pallet_spaces = 47, units_per_pallet = 47,
    updated_at = NOW()
WHERE material_code = 'FG035';
UPDATE materials SET
    length_cm = 13.09, width_cm = 10.61, height_cm = 16.62,
    weight_kg = 1.02, volume_cm3 = 2308.27,
    pallet_spaces = 76, units_per_pallet = 76,
    updated_at = NOW()
WHERE material_code = 'FG036';
UPDATE materials SET
    length_cm = 9.61, width_cm = 6.22, height_cm = 23.32,
    weight_kg = 0.53, volume_cm3 = 1393.93,
    pallet_spaces = 51, units_per_pallet = 51,
    updated_at = NOW()
WHERE material_code = 'FG037';
UPDATE materials SET
    length_cm = 13.66, width_cm = 7.9, height_cm = 29.29,
    weight_kg = 0.46, volume_cm3 = 3160.8,
    pallet_spaces = 88, units_per_pallet = 88,
    updated_at = NOW()
WHERE material_code = 'FG038';
UPDATE materials SET
    length_cm = 11.61, width_cm = 7.54, height_cm = 29.04,
    weight_kg = 0.35, volume_cm3 = 2542.14,
    pallet_spaces = 67, units_per_pallet = 67,
    updated_at = NOW()
WHERE material_code = 'FG039';
UPDATE materials SET
    length_cm = 11.05, width_cm = 11.95, height_cm = 28.38,
    weight_kg = 0.87, volume_cm3 = 3747.51,
    pallet_spaces = 33, units_per_pallet = 33,
    updated_at = NOW()
WHERE material_code = 'FG040';
UPDATE materials SET
    length_cm = 14.24, width_cm = 11.36, height_cm = 22.78,
    weight_kg = 0.48, volume_cm3 = 3685.04,
    pallet_spaces = 31, units_per_pallet = 31,
    updated_at = NOW()
WHERE material_code = 'FG041';
UPDATE materials SET
    length_cm = 12.63, width_cm = 8.24, height_cm = 16.42,
    weight_kg = 0.87, volume_cm3 = 1708.85,
    pallet_spaces = 84, units_per_pallet = 84,
    updated_at = NOW()
WHERE material_code = 'FG042';
UPDATE materials SET
    length_cm = 9.84, width_cm = 11.62, height_cm = 18.61,
    weight_kg = 0.31, volume_cm3 = 2127.88,
    pallet_spaces = 34, units_per_pallet = 34,
    updated_at = NOW()
WHERE material_code = 'FG043';
UPDATE materials SET
    length_cm = 28.07, width_cm = 17.69, height_cm = 19.79,
    weight_kg = 1.09, volume_cm3 = 9826.89,
    pallet_spaces = 53, units_per_pallet = 53,
    updated_at = NOW()
WHERE material_code = 'FG044';
UPDATE materials SET
    length_cm = 28.93, width_cm = 19.65, height_cm = 22.11,
    weight_kg = 1.17, volume_cm3 = 12568.97,
    pallet_spaces = 39, units_per_pallet = 39,
    updated_at = NOW()
WHERE material_code = 'FG045';
UPDATE materials SET
    length_cm = 27.88, width_cm = 15.21, height_cm = 14.99,
    weight_kg = 0.42, volume_cm3 = 6356.58,
    pallet_spaces = 40, units_per_pallet = 40,
    updated_at = NOW()
WHERE material_code = 'FG046';
UPDATE materials SET
    length_cm = 38.55, width_cm = 16.83, height_cm = 18.58,
    weight_kg = 0.92, volume_cm3 = 12054.64,
    pallet_spaces = 50, units_per_pallet = 50,
    updated_at = NOW()
WHERE material_code = 'FG047';
UPDATE materials SET
    length_cm = 29.0, width_cm = 27.06, height_cm = 21.3,
    weight_kg = 0.97, volume_cm3 = 16714.96,
    pallet_spaces = 43, units_per_pallet = 43,
    updated_at = NOW()
WHERE material_code = 'FG048';
UPDATE materials SET
    length_cm = 27.62, width_cm = 16.86, height_cm = 24.06,
    weight_kg = 0.66, volume_cm3 = 11204.1,
    pallet_spaces = 58, units_per_pallet = 58,
    updated_at = NOW()
WHERE material_code = 'FG049';
UPDATE materials SET
    length_cm = 34.77, width_cm = 24.94, height_cm = 24.42,
    weight_kg = 0.56, volume_cm3 = 21176.14,
    pallet_spaces = 32, units_per_pallet = 32,
    updated_at = NOW()
WHERE material_code = 'FG050';
UPDATE materials SET
    length_cm = 43.5, width_cm = 15.37, height_cm = 19.22,
    weight_kg = 0.87, volume_cm3 = 12850.4,
    pallet_spaces = 53, units_per_pallet = 53,
    updated_at = NOW()
WHERE material_code = 'FG051';
UPDATE materials SET
    length_cm = 27.81, width_cm = 21.29, height_cm = 24.56,
    weight_kg = 0.84, volume_cm3 = 14541.36,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'FG052';
UPDATE materials SET
    length_cm = 43.66, width_cm = 27.07, height_cm = 18.08,
    weight_kg = 1.01, volume_cm3 = 21368.32,
    pallet_spaces = 53, units_per_pallet = 53,
    updated_at = NOW()
WHERE material_code = 'FG053';
UPDATE materials SET
    length_cm = 27.18, width_cm = 27.44, height_cm = 22.36,
    weight_kg = 0.51, volume_cm3 = 16676.52,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'FG054';
UPDATE materials SET
    length_cm = 35.62, width_cm = 24.09, height_cm = 23.28,
    weight_kg = 0.84, volume_cm3 = 19976.24,
    pallet_spaces = 31, units_per_pallet = 31,
    updated_at = NOW()
WHERE material_code = 'FG055';
UPDATE materials SET
    length_cm = 18.74, width_cm = 10.98, height_cm = 9.56,
    weight_kg = 0.31, volume_cm3 = 1967.12,
    pallet_spaces = 87, units_per_pallet = 87,
    updated_at = NOW()
WHERE material_code = 'FG056';
UPDATE materials SET
    length_cm = 19.54, width_cm = 9.73, height_cm = 6.66,
    weight_kg = 0.28, volume_cm3 = 1266.23,
    pallet_spaces = 125, units_per_pallet = 125,
    updated_at = NOW()
WHERE material_code = 'FG057';
UPDATE materials SET
    length_cm = 16.05, width_cm = 8.47, height_cm = 9.16,
    weight_kg = 0.12, volume_cm3 = 1245.24,
    pallet_spaces = 123, units_per_pallet = 123,
    updated_at = NOW()
WHERE material_code = 'FG058';
UPDATE materials SET
    length_cm = 23.25, width_cm = 10.17, height_cm = 6.01,
    weight_kg = 0.33, volume_cm3 = 1421.08,
    pallet_spaces = 103, units_per_pallet = 103,
    updated_at = NOW()
WHERE material_code = 'FG059';
UPDATE materials SET
    length_cm = 17.85, width_cm = 9.08, height_cm = 5.81,
    weight_kg = 0.09, volume_cm3 = 941.67,
    pallet_spaces = 64, units_per_pallet = 64,
    updated_at = NOW()
WHERE material_code = 'FG060';
UPDATE materials SET
    length_cm = 15.55, width_cm = 9.22, height_cm = 5.37,
    weight_kg = 0.24, volume_cm3 = 769.9,
    pallet_spaces = 96, units_per_pallet = 96,
    updated_at = NOW()
WHERE material_code = 'FG061';
UPDATE materials SET
    length_cm = 18.94, width_cm = 10.23, height_cm = 8.53,
    weight_kg = 0.32, volume_cm3 = 1652.74,
    pallet_spaces = 111, units_per_pallet = 111,
    updated_at = NOW()
WHERE material_code = 'FG062';
UPDATE materials SET
    length_cm = 23.51, width_cm = 8.3, height_cm = 6.27,
    weight_kg = 0.14, volume_cm3 = 1223.48,
    pallet_spaces = 70, units_per_pallet = 70,
    updated_at = NOW()
WHERE material_code = 'FG063';
UPDATE materials SET
    length_cm = 12.0, width_cm = 6.5, height_cm = 8.69,
    weight_kg = 0.22, volume_cm3 = 677.82,
    pallet_spaces = 62, units_per_pallet = 62,
    updated_at = NOW()
WHERE material_code = 'FG064';
UPDATE materials SET
    length_cm = 11.33, width_cm = 4.61, height_cm = 19.67,
    weight_kg = 0.07, volume_cm3 = 1027.39,
    pallet_spaces = 76, units_per_pallet = 76,
    updated_at = NOW()
WHERE material_code = 'FG065';
UPDATE materials SET
    length_cm = 5.39, width_cm = 9.06, height_cm = 20.64,
    weight_kg = 0.49, volume_cm3 = 1007.92,
    pallet_spaces = 123, units_per_pallet = 123,
    updated_at = NOW()
WHERE material_code = 'FG066';
UPDATE materials SET
    length_cm = 15.23, width_cm = 8.68, height_cm = 16.99,
    weight_kg = 0.4, volume_cm3 = 2246.02,
    pallet_spaces = 106, units_per_pallet = 106,
    updated_at = NOW()
WHERE material_code = 'FG067';
UPDATE materials SET
    length_cm = 11.5, width_cm = 7.09, height_cm = 20.01,
    weight_kg = 0.26, volume_cm3 = 1631.52,
    pallet_spaces = 52, units_per_pallet = 52,
    updated_at = NOW()
WHERE material_code = 'FG068';
UPDATE materials SET
    length_cm = 9.39, width_cm = 7.84, height_cm = 11.73,
    weight_kg = 0.11, volume_cm3 = 863.53,
    pallet_spaces = 79, units_per_pallet = 79,
    updated_at = NOW()
WHERE material_code = 'FG069';
UPDATE materials SET
    length_cm = 9.84, width_cm = 5.4, height_cm = 13.15,
    weight_kg = 0.21, volume_cm3 = 698.74,
    pallet_spaces = 83, units_per_pallet = 83,
    updated_at = NOW()
WHERE material_code = 'FG070';
UPDATE materials SET
    length_cm = 8.58, width_cm = 6.28, height_cm = 17.6,
    weight_kg = 0.18, volume_cm3 = 948.33,
    pallet_spaces = 111, units_per_pallet = 111,
    updated_at = NOW()
WHERE material_code = 'FG071';
UPDATE materials SET
    length_cm = 16.83, width_cm = 6.89, height_cm = 12.6,
    weight_kg = 0.29, volume_cm3 = 1461.08,
    pallet_spaces = 125, units_per_pallet = 125,
    updated_at = NOW()
WHERE material_code = 'FG072';
UPDATE materials SET
    length_cm = 15.88, width_cm = 7.92, height_cm = 19.26,
    weight_kg = 0.29, volume_cm3 = 2422.32,
    pallet_spaces = 108, units_per_pallet = 108,
    updated_at = NOW()
WHERE material_code = 'FG073';
UPDATE materials SET
    length_cm = 8.03, width_cm = 8.41, height_cm = 10.83,
    weight_kg = 0.36, volume_cm3 = 731.37,
    pallet_spaces = 96, units_per_pallet = 96,
    updated_at = NOW()
WHERE material_code = 'FG074';
UPDATE materials SET
    length_cm = 16.05, width_cm = 4.79, height_cm = 16.6,
    weight_kg = 0.09, volume_cm3 = 1276.2,
    pallet_spaces = 95, units_per_pallet = 95,
    updated_at = NOW()
WHERE material_code = 'FG075';
UPDATE materials SET
    length_cm = 5.42, width_cm = 9.68, height_cm = 11.65,
    weight_kg = 0.24, volume_cm3 = 611.22,
    pallet_spaces = 122, units_per_pallet = 122,
    updated_at = NOW()
WHERE material_code = 'FG076';
UPDATE materials SET
    length_cm = 9.0, width_cm = 7.97, height_cm = 19.39,
    weight_kg = 0.21, volume_cm3 = 1390.84,
    pallet_spaces = 143, units_per_pallet = 143,
    updated_at = NOW()
WHERE material_code = 'FG077';
UPDATE materials SET
    length_cm = 6.27, width_cm = 7.95, height_cm = 11.14,
    weight_kg = 0.17, volume_cm3 = 555.29,
    pallet_spaces = 144, units_per_pallet = 144,
    updated_at = NOW()
WHERE material_code = 'FG078';
UPDATE materials SET
    length_cm = 5.86, width_cm = 7.82, height_cm = 16.87,
    weight_kg = 0.14, volume_cm3 = 773.07,
    pallet_spaces = 117, units_per_pallet = 117,
    updated_at = NOW()
WHERE material_code = 'FG079';
UPDATE materials SET
    length_cm = 8.82, width_cm = 9.0, height_cm = 15.91,
    weight_kg = 0.17, volume_cm3 = 1262.94,
    pallet_spaces = 102, units_per_pallet = 102,
    updated_at = NOW()
WHERE material_code = 'FG080';
UPDATE materials SET
    length_cm = 9.66, width_cm = 5.6, height_cm = 11.41,
    weight_kg = 0.07, volume_cm3 = 617.24,
    pallet_spaces = 98, units_per_pallet = 98,
    updated_at = NOW()
WHERE material_code = 'FG081';
UPDATE materials SET
    length_cm = 12.19, width_cm = 12.19, height_cm = 29.41,
    weight_kg = 1.07, volume_cm3 = 4370.21,
    pallet_spaces = 46, units_per_pallet = 46,
    updated_at = NOW()
WHERE material_code = 'FG082';
UPDATE materials SET
    length_cm = 16.98, width_cm = 12.1, height_cm = 22.6,
    weight_kg = 1.12, volume_cm3 = 4643.35,
    pallet_spaces = 41, units_per_pallet = 41,
    updated_at = NOW()
WHERE material_code = 'FG083';
UPDATE materials SET
    length_cm = 9.58, width_cm = 7.18, height_cm = 33.91,
    weight_kg = 1.24, volume_cm3 = 2332.48,
    pallet_spaces = 32, units_per_pallet = 32,
    updated_at = NOW()
WHERE material_code = 'FG084';
UPDATE materials SET
    length_cm = 11.83, width_cm = 11.84, height_cm = 27.4,
    weight_kg = 2.09, volume_cm3 = 3837.84,
    pallet_spaces = 34, units_per_pallet = 34,
    updated_at = NOW()
WHERE material_code = 'FG085';
UPDATE materials SET
    length_cm = 12.79, width_cm = 9.01, height_cm = 34.77,
    weight_kg = 1.72, volume_cm3 = 4006.82,
    pallet_spaces = 51, units_per_pallet = 51,
    updated_at = NOW()
WHERE material_code = 'FG086';
UPDATE materials SET
    length_cm = 17.51, width_cm = 6.95, height_cm = 32.46,
    weight_kg = 1.58, volume_cm3 = 3950.2,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'FG087';
UPDATE materials SET
    length_cm = 13.88, width_cm = 11.49, height_cm = 18.21,
    weight_kg = 1.27, volume_cm3 = 2904.15,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'FG088';
UPDATE materials SET
    length_cm = 16.25, width_cm = 8.36, height_cm = 25.8,
    weight_kg = 1.25, volume_cm3 = 3504.93,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'FG089';
UPDATE materials SET
    length_cm = 17.18, width_cm = 12.25, height_cm = 19.88,
    weight_kg = 2.19, volume_cm3 = 4183.85,
    pallet_spaces = 32, units_per_pallet = 32,
    updated_at = NOW()
WHERE material_code = 'FG090';
UPDATE materials SET
    length_cm = 16.79, width_cm = 8.27, height_cm = 32.23,
    weight_kg = 0.68, volume_cm3 = 4475.24,
    pallet_spaces = 46, units_per_pallet = 46,
    updated_at = NOW()
WHERE material_code = 'FG091';
UPDATE materials SET
    length_cm = 19.99, width_cm = 11.85, height_cm = 6.18,
    weight_kg = 0.36, volume_cm3 = 1463.93,
    pallet_spaces = 119, units_per_pallet = 119,
    updated_at = NOW()
WHERE material_code = 'FG092';
UPDATE materials SET
    length_cm = 10.43, width_cm = 8.17, height_cm = 6.86,
    weight_kg = 0.32, volume_cm3 = 584.56,
    pallet_spaces = 104, units_per_pallet = 104,
    updated_at = NOW()
WHERE material_code = 'FG093';
UPDATE materials SET
    length_cm = 23.66, width_cm = 11.91, height_cm = 5.47,
    weight_kg = 0.05, volume_cm3 = 1541.39,
    pallet_spaces = 55, units_per_pallet = 55,
    updated_at = NOW()
WHERE material_code = 'FG094';
UPDATE materials SET
    length_cm = 10.77, width_cm = 11.45, height_cm = 15.42,
    weight_kg = 0.13, volume_cm3 = 1901.54,
    pallet_spaces = 63, units_per_pallet = 63,
    updated_at = NOW()
WHERE material_code = 'FG095';
UPDATE materials SET
    length_cm = 10.86, width_cm = 13.21, height_cm = 17.06,
    weight_kg = 0.32, volume_cm3 = 2447.44,
    pallet_spaces = 107, units_per_pallet = 107,
    updated_at = NOW()
WHERE material_code = 'FG096';
UPDATE materials SET
    length_cm = 20.47, width_cm = 13.54, height_cm = 5.52,
    weight_kg = 0.12, volume_cm3 = 1529.94,
    pallet_spaces = 49, units_per_pallet = 49,
    updated_at = NOW()
WHERE material_code = 'FG097';
UPDATE materials SET
    length_cm = 17.57, width_cm = 12.71, height_cm = 13.19,
    weight_kg = 0.35, volume_cm3 = 2945.52,
    pallet_spaces = 49, units_per_pallet = 49,
    updated_at = NOW()
WHERE material_code = 'FG098';
UPDATE materials SET
    length_cm = 22.33, width_cm = 22.35, height_cm = 11.93,
    weight_kg = 0.91, volume_cm3 = 5953.97,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'FG099';
UPDATE materials SET
    length_cm = 34.7, width_cm = 21.12, height_cm = 10.55,
    weight_kg = 1.42, volume_cm3 = 7731.72,
    pallet_spaces = 39, units_per_pallet = 39,
    updated_at = NOW()
WHERE material_code = 'FG100';
UPDATE materials SET
    length_cm = 20.64, width_cm = 23.84, height_cm = 17.1,
    weight_kg = 0.76, volume_cm3 = 8414.18,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'FG101';
UPDATE materials SET
    length_cm = 22.75, width_cm = 24.8, height_cm = 14.59,
    weight_kg = 1.68, volume_cm3 = 8231.68,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'FG102';
UPDATE materials SET
    length_cm = 29.55, width_cm = 20.72, height_cm = 11.45,
    weight_kg = 1.92, volume_cm3 = 7010.56,
    pallet_spaces = 33, units_per_pallet = 33,
    updated_at = NOW()
WHERE material_code = 'FG103';
UPDATE materials SET
    length_cm = 57.89, width_cm = 58.5, height_cm = 89.54,
    weight_kg = 215.84, volume_cm3 = 303233.03,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100005';
UPDATE materials SET
    length_cm = 57.02, width_cm = 57.37, height_cm = 85.83,
    weight_kg = 159.39, volume_cm3 = 280770.31,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100006';
UPDATE materials SET
    length_cm = 18.56, width_cm = 19.16, height_cm = 19.52,
    weight_kg = 10.59, volume_cm3 = 6941.5,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM100010';
UPDATE materials SET
    length_cm = 57.04, width_cm = 56.09, height_cm = 89.12,
    weight_kg = 145.36, volume_cm3 = 285128.18,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100012';
UPDATE materials SET
    length_cm = 21.28, width_cm = 19.74, height_cm = 17.26,
    weight_kg = 14.74, volume_cm3 = 7250.36,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM100016';
UPDATE materials SET
    length_cm = 26.32, width_cm = 22.02, height_cm = 24.72,
    weight_kg = 19.92, volume_cm3 = 14326.88,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM100018';
UPDATE materials SET
    length_cm = 25.75, width_cm = 18.24, height_cm = 16.47,
    weight_kg = 15.84, volume_cm3 = 7735.63,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM100019';
UPDATE materials SET
    length_cm = 57.56, width_cm = 58.68, height_cm = 91.2,
    weight_kg = 214.47, volume_cm3 = 308039.02,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100026';
UPDATE materials SET
    length_cm = 54.0, width_cm = 39.43, height_cm = 83.54,
    weight_kg = 136.18, volume_cm3 = 177875.04,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100028';
UPDATE materials SET
    length_cm = 42.16, width_cm = 41.84, height_cm = 10.83,
    weight_kg = 28.42, volume_cm3 = 19103.84,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM100030';
UPDATE materials SET
    length_cm = 17.59, width_cm = 18.14, height_cm = 22.43,
    weight_kg = 1.35, volume_cm3 = 7157.02,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM100031';
UPDATE materials SET
    length_cm = 59.14, width_cm = 59.28, height_cm = 87.61,
    weight_kg = 132.29, volume_cm3 = 307144.82,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100033';
UPDATE materials SET
    length_cm = 12.39, width_cm = 15.47, height_cm = 24.38,
    weight_kg = 24.89, volume_cm3 = 4673.0,
    pallet_spaces = 25, units_per_pallet = 25,
    updated_at = NOW()
WHERE material_code = 'RM100035';
UPDATE materials SET
    length_cm = 39.33, width_cm = 50.63, height_cm = 76.68,
    weight_kg = 112.26, volume_cm3 = 152691.19,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100036';
UPDATE materials SET
    length_cm = 45.75, width_cm = 34.91, height_cm = 48.63,
    weight_kg = 169.72, volume_cm3 = 77668.55,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100038';
UPDATE materials SET
    length_cm = 59.2, width_cm = 59.95, height_cm = 85.99,
    weight_kg = 155.86, volume_cm3 = 305181.95,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100039';
UPDATE materials SET
    length_cm = 55.4, width_cm = 58.78, height_cm = 88.04,
    weight_kg = 157.55, volume_cm3 = 286694.51,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100043';
UPDATE materials SET
    length_cm = 55.75, width_cm = 55.9, height_cm = 91.35,
    weight_kg = 123.57, volume_cm3 = 284685.42,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100044';
UPDATE materials SET
    length_cm = 14.38, width_cm = 14.9, height_cm = 18.8,
    weight_kg = 15.05, volume_cm3 = 4028.13,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM100046';
UPDATE materials SET
    length_cm = 59.22, width_cm = 58.19, height_cm = 89.54,
    weight_kg = 196.91, volume_cm3 = 308555.9,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100050';
UPDATE materials SET
    length_cm = 15.5, width_cm = 15.4, height_cm = 15.08,
    weight_kg = 25.41, volume_cm3 = 3599.6,
    pallet_spaces = 23, units_per_pallet = 23,
    updated_at = NOW()
WHERE material_code = 'RM100066';
UPDATE materials SET
    length_cm = 25.37, width_cm = 22.78, height_cm = 17.57,
    weight_kg = 22.78, volume_cm3 = 10154.21,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM100069';
UPDATE materials SET
    length_cm = 59.25, width_cm = 56.7, height_cm = 88.49,
    weight_kg = 162.51, volume_cm3 = 297279.94,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100071';
UPDATE materials SET
    length_cm = 33.15, width_cm = 41.96, height_cm = 87.7,
    weight_kg = 131.7, volume_cm3 = 121988.42,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100072';
UPDATE materials SET
    length_cm = 35.75, width_cm = 30.74, height_cm = 88.23,
    weight_kg = 125.85, volume_cm3 = 96960.8,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100078';
UPDATE materials SET
    length_cm = 57.99, width_cm = 55.04, height_cm = 86.95,
    weight_kg = 176.24, volume_cm3 = 277524.37,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100080';
UPDATE materials SET
    length_cm = 29.64, width_cm = 19.31, height_cm = 17.16,
    weight_kg = 19.16, volume_cm3 = 9821.5,
    pallet_spaces = 26, units_per_pallet = 26,
    updated_at = NOW()
WHERE material_code = 'RM100084';
UPDATE materials SET
    length_cm = 28.55, width_cm = 22.21, height_cm = 24.63,
    weight_kg = 19.77, volume_cm3 = 15617.77,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'RM100085';
UPDATE materials SET
    length_cm = 16.71, width_cm = 22.32, height_cm = 19.4,
    weight_kg = 14.27, volume_cm3 = 7235.56,
    pallet_spaces = 35, units_per_pallet = 35,
    updated_at = NOW()
WHERE material_code = 'RM100086';
UPDATE materials SET
    length_cm = 58.27, width_cm = 59.85, height_cm = 91.89,
    weight_kg = 143.06, volume_cm3 = 320462.65,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100090';
UPDATE materials SET
    length_cm = 52.5, width_cm = 40.39, height_cm = 46.44,
    weight_kg = 22.58, volume_cm3 = 98474.86,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100093';
UPDATE materials SET
    length_cm = 19.79, width_cm = 24.78, height_cm = 16.97,
    weight_kg = 24.46, volume_cm3 = 8322.02,
    pallet_spaces = 12, units_per_pallet = 12,
    updated_at = NOW()
WHERE material_code = 'RM100094';
UPDATE materials SET
    length_cm = 25.87, width_cm = 11.27, height_cm = 18.33,
    weight_kg = 20.15, volume_cm3 = 5344.2,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM100097';
UPDATE materials SET
    length_cm = 59.11, width_cm = 55.18, height_cm = 87.61,
    weight_kg = 153.41, volume_cm3 = 285756.64,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100098';
UPDATE materials SET
    length_cm = 51.4, width_cm = 53.21, height_cm = 85.0,
    weight_kg = 191.37, volume_cm3 = 232474.49,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100099';
UPDATE materials SET
    length_cm = 31.47, width_cm = 37.04, height_cm = 72.34,
    weight_kg = 218.08, volume_cm3 = 84323.03,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100100';
UPDATE materials SET
    length_cm = 50.32, width_cm = 30.89, height_cm = 60.87,
    weight_kg = 226.52, volume_cm3 = 94615.4,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100105';
UPDATE materials SET
    length_cm = 14.75, width_cm = 22.79, height_cm = 15.22,
    weight_kg = 21.41, volume_cm3 = 5116.24,
    pallet_spaces = 36, units_per_pallet = 36,
    updated_at = NOW()
WHERE material_code = 'RM100108';
UPDATE materials SET
    length_cm = 47.71, width_cm = 41.91, height_cm = 54.29,
    weight_kg = 224.48, volume_cm3 = 108554.27,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100109';
UPDATE materials SET
    length_cm = 16.27, width_cm = 18.42, height_cm = 22.18,
    weight_kg = 20.38, volume_cm3 = 6647.2,
    pallet_spaces = 23, units_per_pallet = 23,
    updated_at = NOW()
WHERE material_code = 'RM100110';
UPDATE materials SET
    length_cm = 15.93, width_cm = 16.12, height_cm = 12.05,
    weight_kg = 14.58, volume_cm3 = 3094.34,
    pallet_spaces = 39, units_per_pallet = 39,
    updated_at = NOW()
WHERE material_code = 'RM100117';
UPDATE materials SET
    length_cm = 29.95, width_cm = 20.51, height_cm = 18.93,
    weight_kg = 10.11, volume_cm3 = 11628.22,
    pallet_spaces = 21, units_per_pallet = 21,
    updated_at = NOW()
WHERE material_code = 'RM100118';
UPDATE materials SET
    length_cm = 44.91, width_cm = 34.03, height_cm = 59.0,
    weight_kg = 40.11, volume_cm3 = 90168.95,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100119';
UPDATE materials SET
    length_cm = 55.09, width_cm = 57.27, height_cm = 89.44,
    weight_kg = 147.46, volume_cm3 = 282183.58,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100120';
UPDATE materials SET
    length_cm = 29.39, width_cm = 22.52, height_cm = 20.41,
    weight_kg = 7.83, volume_cm3 = 13508.62,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM100125';
UPDATE materials SET
    length_cm = 28.45, width_cm = 17.35, height_cm = 18.25,
    weight_kg = 22.82, volume_cm3 = 9008.34,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM100127';
UPDATE materials SET
    length_cm = 24.85, width_cm = 18.86, height_cm = 19.8,
    weight_kg = 7.83, volume_cm3 = 9279.69,
    pallet_spaces = 23, units_per_pallet = 23,
    updated_at = NOW()
WHERE material_code = 'RM100128';
UPDATE materials SET
    length_cm = 37.24, width_cm = 39.67, height_cm = 48.08,
    weight_kg = 176.75, volume_cm3 = 71029.1,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100130';
UPDATE materials SET
    length_cm = 26.88, width_cm = 22.84, height_cm = 19.38,
    weight_kg = 12.43, volume_cm3 = 11898.14,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM100132';
UPDATE materials SET
    length_cm = 29.89, width_cm = 20.12, height_cm = 22.22,
    weight_kg = 22.61, volume_cm3 = 13362.81,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM100134';
UPDATE materials SET
    length_cm = 12.78, width_cm = 15.62, height_cm = 11.53,
    weight_kg = 19.76, volume_cm3 = 2301.66,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM100140';
UPDATE materials SET
    length_cm = 17.69, width_cm = 14.33, height_cm = 10.54,
    weight_kg = 28.81, volume_cm3 = 2671.87,
    pallet_spaces = 23, units_per_pallet = 23,
    updated_at = NOW()
WHERE material_code = 'RM100143';
UPDATE materials SET
    length_cm = 13.69, width_cm = 10.66, height_cm = 16.83,
    weight_kg = 15.72, volume_cm3 = 2456.09,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM100147';
UPDATE materials SET
    length_cm = 10.76, width_cm = 11.12, height_cm = 15.77,
    weight_kg = 2.29, volume_cm3 = 1886.9,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'RM100149';
UPDATE materials SET
    length_cm = 14.53, width_cm = 13.94, height_cm = 16.25,
    weight_kg = 0.55, volume_cm3 = 3291.41,
    pallet_spaces = 22, units_per_pallet = 22,
    updated_at = NOW()
WHERE material_code = 'RM100151';
UPDATE materials SET
    length_cm = 22.94, width_cm = 10.01, height_cm = 17.62,
    weight_kg = 14.94, volume_cm3 = 4046.07,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM100152';
UPDATE materials SET
    length_cm = 21.71, width_cm = 18.41, height_cm = 13.91,
    weight_kg = 10.01, volume_cm3 = 5559.56,
    pallet_spaces = 12, units_per_pallet = 12,
    updated_at = NOW()
WHERE material_code = 'RM100158';
UPDATE materials SET
    length_cm = 17.2, width_cm = 16.83, height_cm = 13.42,
    weight_kg = 10.26, volume_cm3 = 3884.77,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM100160';
UPDATE materials SET
    length_cm = 16.91, width_cm = 17.12, height_cm = 12.26,
    weight_kg = 1.9, volume_cm3 = 3549.26,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM100162';
UPDATE materials SET
    length_cm = 23.78, width_cm = 10.09, height_cm = 12.82,
    weight_kg = 1.42, volume_cm3 = 3076.03,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM100165';
UPDATE materials SET
    length_cm = 13.62, width_cm = 15.69, height_cm = 18.85,
    weight_kg = 25.56, volume_cm3 = 4028.2,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM100171';
UPDATE materials SET
    length_cm = 22.8, width_cm = 16.19, height_cm = 12.44,
    weight_kg = 23.3, volume_cm3 = 4592.0,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM100178';
UPDATE materials SET
    length_cm = 23.78, width_cm = 14.54, height_cm = 19.05,
    weight_kg = 29.55, volume_cm3 = 6586.75,
    pallet_spaces = 26, units_per_pallet = 26,
    updated_at = NOW()
WHERE material_code = 'RM100183';
UPDATE materials SET
    length_cm = 54.39, width_cm = 39.55, height_cm = 81.56,
    weight_kg = 126.14, volume_cm3 = 175445.71,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100198';
UPDATE materials SET
    length_cm = 56.59, width_cm = 55.39, height_cm = 85.21,
    weight_kg = 174.25, volume_cm3 = 267092.46,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100201';
UPDATE materials SET
    length_cm = 18.31, width_cm = 22.25, height_cm = 25.62,
    weight_kg = 22.42, volume_cm3 = 10437.52,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM100202';
UPDATE materials SET
    length_cm = 27.8, width_cm = 18.91, height_cm = 11.89,
    weight_kg = 4.02, volume_cm3 = 6250.55,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM100304';
UPDATE materials SET
    length_cm = 20.4, width_cm = 11.73, height_cm = 17.61,
    weight_kg = 29.76, volume_cm3 = 4213.93,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM100323';
UPDATE materials SET
    length_cm = 34.86, width_cm = 20.85, height_cm = 16.9,
    weight_kg = 27.02, volume_cm3 = 12283.44,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM100346';
UPDATE materials SET
    length_cm = 46.09, width_cm = 48.65, height_cm = 54.21,
    weight_kg = 24.35, volume_cm3 = 121553.92,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM100403';
UPDATE materials SET
    length_cm = 19.95, width_cm = 18.36, height_cm = 10.27,
    weight_kg = 18.07, volume_cm3 = 3761.72,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM100448';
UPDATE materials SET
    length_cm = 56.27, width_cm = 58.05, height_cm = 88.87,
    weight_kg = 151.69, volume_cm3 = 290291.5,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100460';
UPDATE materials SET
    length_cm = 58.63, width_cm = 57.83, height_cm = 90.31,
    weight_kg = 198.67, volume_cm3 = 306202.64,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100473';
UPDATE materials SET
    length_cm = 23.39, width_cm = 20.15, height_cm = 15.19,
    weight_kg = 24.08, volume_cm3 = 7159.18,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM100483';
UPDATE materials SET
    length_cm = 16.12, width_cm = 10.94, height_cm = 23.34,
    weight_kg = 12.15, volume_cm3 = 4116.07,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM100503';
UPDATE materials SET
    length_cm = 12.24, width_cm = 19.62, height_cm = 12.68,
    weight_kg = 6.39, volume_cm3 = 3045.09,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'RM100525';
UPDATE materials SET
    length_cm = 46.36, width_cm = 34.4, height_cm = 21.0,
    weight_kg = 46.35, volume_cm3 = 33490.46,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM100527';
UPDATE materials SET
    length_cm = 15.69, width_cm = 15.17, height_cm = 21.13,
    weight_kg = 22.07, volume_cm3 = 5029.31,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM100535';
UPDATE materials SET
    length_cm = 11.57, width_cm = 19.04, height_cm = 22.98,
    weight_kg = 24.04, volume_cm3 = 5062.33,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM100536';
UPDATE materials SET
    length_cm = 13.07, width_cm = 17.44, height_cm = 10.35,
    weight_kg = 29.39, volume_cm3 = 2359.19,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM100537';
UPDATE materials SET
    length_cm = 23.31, width_cm = 13.95, height_cm = 14.79,
    weight_kg = 18.46, volume_cm3 = 4809.33,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM100594';
UPDATE materials SET
    length_cm = 42.27, width_cm = 48.05, height_cm = 88.64,
    weight_kg = 130.22, volume_cm3 = 180034.36,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100713';
UPDATE materials SET
    length_cm = 55.66, width_cm = 55.81, height_cm = 89.79,
    weight_kg = 147.16, volume_cm3 = 278922.27,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM100714';
UPDATE materials SET
    length_cm = 24.32, width_cm = 12.44, height_cm = 11.48,
    weight_kg = 22.73, volume_cm3 = 3473.17,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM100835';
UPDATE materials SET
    length_cm = 13.03, width_cm = 11.86, height_cm = 17.83,
    weight_kg = 14.32, volume_cm3 = 2755.37,
    pallet_spaces = 26, units_per_pallet = 26,
    updated_at = NOW()
WHERE material_code = 'RM100840';
UPDATE materials SET
    length_cm = 55.23, width_cm = 57.41, height_cm = 91.72,
    weight_kg = 195.68, volume_cm3 = 290821.58,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM100873';
UPDATE materials SET
    length_cm = 13.79, width_cm = 12.95, height_cm = 21.47,
    weight_kg = 26.36, volume_cm3 = 3834.12,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM100874';
UPDATE materials SET
    length_cm = 24.77, width_cm = 19.82, height_cm = 24.29,
    weight_kg = 2.62, volume_cm3 = 11924.97,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM100894';
UPDATE materials SET
    length_cm = 93.17, width_cm = 21.94, height_cm = 36.92,
    weight_kg = 20.42, volume_cm3 = 75470.01,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM100903';
UPDATE materials SET
    length_cm = 92.54, width_cm = 23.31, height_cm = 25.07,
    weight_kg = 9.01, volume_cm3 = 54078.68,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM100904';
UPDATE materials SET
    length_cm = 26.68, width_cm = 22.35, height_cm = 19.44,
    weight_kg = 11.77, volume_cm3 = 11592.03,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM100913';
UPDATE materials SET
    length_cm = 16.07, width_cm = 17.6, height_cm = 21.59,
    weight_kg = 6.6, volume_cm3 = 6106.34,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM100986';
UPDATE materials SET
    length_cm = 28.44, width_cm = 16.0, height_cm = 17.65,
    weight_kg = 21.32, volume_cm3 = 8031.46,
    pallet_spaces = 37, units_per_pallet = 37,
    updated_at = NOW()
WHERE material_code = 'RM101015';
UPDATE materials SET
    length_cm = 17.69, width_cm = 19.14, height_cm = 19.5,
    weight_kg = 6.89, volume_cm3 = 6602.44,
    pallet_spaces = 35, units_per_pallet = 35,
    updated_at = NOW()
WHERE material_code = 'RM101016';
UPDATE materials SET
    length_cm = 27.77, width_cm = 23.75, height_cm = 18.39,
    weight_kg = 13.74, volume_cm3 = 12128.89,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM101017';
UPDATE materials SET
    length_cm = 13.73, width_cm = 12.45, height_cm = 12.42,
    weight_kg = 28.23, volume_cm3 = 2123.06,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM101028';
UPDATE materials SET
    length_cm = 20.35, width_cm = 17.36, height_cm = 17.95,
    weight_kg = 13.65, volume_cm3 = 6341.3,
    pallet_spaces = 35, units_per_pallet = 35,
    updated_at = NOW()
WHERE material_code = 'RM101043';
UPDATE materials SET
    length_cm = 33.95, width_cm = 33.77, height_cm = 89.52,
    weight_kg = 133.46, volume_cm3 = 102633.92,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101054';
UPDATE materials SET
    length_cm = 18.32, width_cm = 12.08, height_cm = 13.8,
    weight_kg = 1.39, volume_cm3 = 3054.02,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101065';
UPDATE materials SET
    length_cm = 23.75, width_cm = 13.22, height_cm = 19.12,
    weight_kg = 14.22, volume_cm3 = 6003.2,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM101073';
UPDATE materials SET
    length_cm = 45.62, width_cm = 44.77, height_cm = 22.27,
    weight_kg = 42.25, volume_cm3 = 45484.41,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101083';
UPDATE materials SET
    length_cm = 22.03, width_cm = 16.53, height_cm = 24.21,
    weight_kg = 9.19, volume_cm3 = 8816.21,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM101085';
UPDATE materials SET
    length_cm = 56.71, width_cm = 58.97, height_cm = 89.36,
    weight_kg = 202.56, volume_cm3 = 298836.7,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101091';
UPDATE materials SET
    length_cm = 14.24, width_cm = 23.86, height_cm = 16.57,
    weight_kg = 16.16, volume_cm3 = 5629.93,
    pallet_spaces = 31, units_per_pallet = 31,
    updated_at = NOW()
WHERE material_code = 'RM101163';
UPDATE materials SET
    length_cm = 69.8, width_cm = 30.62, height_cm = 10.93,
    weight_kg = 33.75, volume_cm3 = 23360.43,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM101203';
UPDATE materials SET
    length_cm = 12.58, width_cm = 12.28, height_cm = 19.48,
    weight_kg = 10.13, volume_cm3 = 3009.32,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101204';
UPDATE materials SET
    length_cm = 39.57, width_cm = 51.79, height_cm = 63.98,
    weight_kg = 137.09, volume_cm3 = 131116.15,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101207';
UPDATE materials SET
    length_cm = 19.46, width_cm = 24.25, height_cm = 15.14,
    weight_kg = 4.84, volume_cm3 = 7144.64,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101208';
UPDATE materials SET
    length_cm = 26.92, width_cm = 10.6, height_cm = 16.74,
    weight_kg = 22.37, volume_cm3 = 4776.79,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101211';
UPDATE materials SET
    length_cm = 24.99, width_cm = 24.88, height_cm = 17.97,
    weight_kg = 16.67, volume_cm3 = 11172.87,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101216';
UPDATE materials SET
    length_cm = 24.21, width_cm = 13.66, height_cm = 21.08,
    weight_kg = 12.39, volume_cm3 = 6971.34,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101223';
UPDATE materials SET
    length_cm = 29.4, width_cm = 20.09, height_cm = 28.61,
    weight_kg = 13.16, volume_cm3 = 16898.38,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101234';
UPDATE materials SET
    length_cm = 50.27, width_cm = 33.16, height_cm = 16.6,
    weight_kg = 23.77, volume_cm3 = 27671.42,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM101235';
UPDATE materials SET
    length_cm = 32.75, width_cm = 50.02, height_cm = 74.09,
    weight_kg = 137.64, volume_cm3 = 121370.9,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101264';
UPDATE materials SET
    length_cm = 12.97, width_cm = 17.78, height_cm = 22.91,
    weight_kg = 7.78, volume_cm3 = 5283.2,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM101265';
UPDATE materials SET
    length_cm = 11.94, width_cm = 12.75, height_cm = 12.08,
    weight_kg = 8.86, volume_cm3 = 1839.0,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101267';
UPDATE materials SET
    length_cm = 18.04, width_cm = 20.42, height_cm = 22.01,
    weight_kg = 23.87, volume_cm3 = 8107.97,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101271';
UPDATE materials SET
    length_cm = 58.3, width_cm = 30.1, height_cm = 19.38,
    weight_kg = 29.61, volume_cm3 = 34008.61,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101273';
UPDATE materials SET
    length_cm = 51.99, width_cm = 38.71, height_cm = 10.35,
    weight_kg = 32.0, volume_cm3 = 20829.72,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM101274';
UPDATE materials SET
    length_cm = 27.5, width_cm = 19.15, height_cm = 16.66,
    weight_kg = 23.43, volume_cm3 = 8773.57,
    pallet_spaces = 34, units_per_pallet = 34,
    updated_at = NOW()
WHERE material_code = 'RM101275';
UPDATE materials SET
    length_cm = 21.44, width_cm = 20.45, height_cm = 22.35,
    weight_kg = 19.33, volume_cm3 = 9799.31,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101276';
UPDATE materials SET
    length_cm = 21.68, width_cm = 17.44, height_cm = 28.69,
    weight_kg = 27.79, volume_cm3 = 10847.67,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101277';
UPDATE materials SET
    length_cm = 24.67, width_cm = 17.45, height_cm = 21.47,
    weight_kg = 23.0, volume_cm3 = 9242.65,
    pallet_spaces = 25, units_per_pallet = 25,
    updated_at = NOW()
WHERE material_code = 'RM101278';
UPDATE materials SET
    length_cm = 16.85, width_cm = 12.4, height_cm = 19.67,
    weight_kg = 9.03, volume_cm3 = 4109.85,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101279';
UPDATE materials SET
    length_cm = 16.15, width_cm = 12.19, height_cm = 22.24,
    weight_kg = 25.89, volume_cm3 = 4378.36,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101280';
UPDATE materials SET
    length_cm = 40.23, width_cm = 31.72, height_cm = 21.96,
    weight_kg = 45.18, volume_cm3 = 28023.06,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101281';
UPDATE materials SET
    length_cm = 63.23, width_cm = 27.31, height_cm = 15.85,
    weight_kg = 49.96, volume_cm3 = 27369.96,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101282';
UPDATE materials SET
    length_cm = 55.96, width_cm = 55.77, height_cm = 87.96,
    weight_kg = 169.57, volume_cm3 = 274513.41,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101283';
UPDATE materials SET
    length_cm = 69.42, width_cm = 26.39, height_cm = 12.07,
    weight_kg = 43.72, volume_cm3 = 22112.17,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101285';
UPDATE materials SET
    length_cm = 19.06, width_cm = 23.85, height_cm = 21.63,
    weight_kg = 3.68, volume_cm3 = 9832.59,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM101286';
UPDATE materials SET
    length_cm = 35.29, width_cm = 42.7, height_cm = 68.71,
    weight_kg = 107.64, volume_cm3 = 103537.93,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101287';
UPDATE materials SET
    length_cm = 59.58, width_cm = 44.84, height_cm = 24.99,
    weight_kg = 35.49, volume_cm3 = 66762.46,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM101288';
UPDATE materials SET
    length_cm = 103.67, width_cm = 39.53, height_cm = 26.37,
    weight_kg = 16.53, volume_cm3 = 108066.24,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM101293';
UPDATE materials SET
    length_cm = 85.49, width_cm = 21.03, height_cm = 33.45,
    weight_kg = 13.83, volume_cm3 = 60138.24,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101295';
UPDATE materials SET
    length_cm = 109.93, width_cm = 36.42, height_cm = 28.33,
    weight_kg = 13.04, volume_cm3 = 113423.42,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101298';
UPDATE materials SET
    length_cm = 104.93, width_cm = 36.03, height_cm = 29.83,
    weight_kg = 27.33, volume_cm3 = 112776.13,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101299';
UPDATE materials SET
    length_cm = 112.74, width_cm = 21.92, height_cm = 23.07,
    weight_kg = 18.35, volume_cm3 = 57011.99,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101300';
UPDATE materials SET
    length_cm = 64.05, width_cm = 21.06, height_cm = 20.01,
    weight_kg = 15.91, volume_cm3 = 26991.35,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101302';
UPDATE materials SET
    length_cm = 15.7, width_cm = 21.52, height_cm = 27.35,
    weight_kg = 5.87, volume_cm3 = 9240.58,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101304';
UPDATE materials SET
    length_cm = 17.94, width_cm = 23.61, height_cm = 27.35,
    weight_kg = 16.63, volume_cm3 = 11584.46,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101305';
UPDATE materials SET
    length_cm = 65.57, width_cm = 27.89, height_cm = 34.76,
    weight_kg = 11.44, volume_cm3 = 63567.26,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101307';
UPDATE materials SET
    length_cm = 105.14, width_cm = 30.08, height_cm = 35.01,
    weight_kg = 16.62, volume_cm3 = 110723.02,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101308';
UPDATE materials SET
    length_cm = 73.15, width_cm = 24.17, height_cm = 35.03,
    weight_kg = 7.97, volume_cm3 = 61934.28,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101345';
UPDATE materials SET
    length_cm = 65.16, width_cm = 23.53, height_cm = 23.51,
    weight_kg = 25.58, volume_cm3 = 36045.88,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM101346';
UPDATE materials SET
    length_cm = 119.42, width_cm = 22.74, height_cm = 33.07,
    weight_kg = 16.22, volume_cm3 = 89805.25,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101359';
UPDATE materials SET
    length_cm = 15.89, width_cm = 18.75, height_cm = 24.63,
    weight_kg = 26.25, volume_cm3 = 7338.2,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101363';
UPDATE materials SET
    length_cm = 19.84, width_cm = 12.89, height_cm = 21.02,
    weight_kg = 17.21, volume_cm3 = 5375.6,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101364';
UPDATE materials SET
    length_cm = 22.43, width_cm = 17.11, height_cm = 10.4,
    weight_kg = 1.96, volume_cm3 = 3991.28,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101365';
UPDATE materials SET
    length_cm = 13.9, width_cm = 14.19, height_cm = 21.37,
    weight_kg = 24.89, volume_cm3 = 4215.04,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM101366';
UPDATE materials SET
    length_cm = 22.71, width_cm = 17.71, height_cm = 22.83,
    weight_kg = 10.13, volume_cm3 = 9182.09,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101369';
UPDATE materials SET
    length_cm = 20.15, width_cm = 10.66, height_cm = 10.02,
    weight_kg = 6.76, volume_cm3 = 2152.29,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101370';
UPDATE materials SET
    length_cm = 49.39, width_cm = 35.16, height_cm = 86.29,
    weight_kg = 101.94, volume_cm3 = 149847.11,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101373';
UPDATE materials SET
    length_cm = 31.78, width_cm = 36.46, height_cm = 70.46,
    weight_kg = 51.17, volume_cm3 = 81641.92,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101374';
UPDATE materials SET
    length_cm = 36.42, width_cm = 32.97, height_cm = 50.76,
    weight_kg = 93.21, volume_cm3 = 60950.95,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101375';
UPDATE materials SET
    length_cm = 55.81, width_cm = 39.61, height_cm = 58.76,
    weight_kg = 25.23, volume_cm3 = 129896.86,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101376';
UPDATE materials SET
    length_cm = 15.3, width_cm = 19.16, height_cm = 13.08,
    weight_kg = 22.26, volume_cm3 = 3834.38,
    pallet_spaces = 5, units_per_pallet = 5,
    updated_at = NOW()
WHERE material_code = 'RM101377';
UPDATE materials SET
    length_cm = 55.5, width_cm = 55.54, height_cm = 85.81,
    weight_kg = 169.57, volume_cm3 = 264506.75,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101378';
UPDATE materials SET
    length_cm = 43.66, width_cm = 42.05, height_cm = 21.31,
    weight_kg = 44.59, volume_cm3 = 39123.09,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101379';
UPDATE materials SET
    length_cm = 29.93, width_cm = 10.66, height_cm = 16.02,
    weight_kg = 8.44, volume_cm3 = 5111.24,
    pallet_spaces = 22, units_per_pallet = 22,
    updated_at = NOW()
WHERE material_code = 'RM101380';
UPDATE materials SET
    length_cm = 24.23, width_cm = 15.77, height_cm = 22.09,
    weight_kg = 5.53, volume_cm3 = 8440.75,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM101382';
UPDATE materials SET
    length_cm = 17.41, width_cm = 19.71, height_cm = 15.71,
    weight_kg = 12.23, volume_cm3 = 5390.9,
    pallet_spaces = 29, units_per_pallet = 29,
    updated_at = NOW()
WHERE material_code = 'RM101389';
UPDATE materials SET
    length_cm = 11.92, width_cm = 13.21, height_cm = 12.9,
    weight_kg = 3.55, volume_cm3 = 2031.28,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM101390';
UPDATE materials SET
    length_cm = 50.76, width_cm = 33.17, height_cm = 16.47,
    weight_kg = 38.99, volume_cm3 = 27730.69,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101394';
UPDATE materials SET
    length_cm = 28.54, width_cm = 23.99, height_cm = 15.87,
    weight_kg = 8.57, volume_cm3 = 10865.79,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM101396';
UPDATE materials SET
    length_cm = 18.52, width_cm = 14.62, height_cm = 19.88,
    weight_kg = 16.85, volume_cm3 = 5382.76,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101397';
UPDATE materials SET
    length_cm = 15.19, width_cm = 13.79, height_cm = 11.42,
    weight_kg = 5.4, volume_cm3 = 2392.15,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101398';
UPDATE materials SET
    length_cm = 13.22, width_cm = 15.63, height_cm = 21.33,
    weight_kg = 8.09, volume_cm3 = 4407.39,
    pallet_spaces = 22, units_per_pallet = 22,
    updated_at = NOW()
WHERE material_code = 'RM101399';
UPDATE materials SET
    length_cm = 23.91, width_cm = 15.97, height_cm = 20.03,
    weight_kg = 2.05, volume_cm3 = 7648.31,
    pallet_spaces = 21, units_per_pallet = 21,
    updated_at = NOW()
WHERE material_code = 'RM101401';
UPDATE materials SET
    length_cm = 59.62, width_cm = 57.89, height_cm = 85.03,
    weight_kg = 123.08, volume_cm3 = 293472.7,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101402';
UPDATE materials SET
    length_cm = 20.21, width_cm = 15.63, height_cm = 10.4,
    weight_kg = 22.43, volume_cm3 = 3285.18,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101405';
UPDATE materials SET
    length_cm = 19.32, width_cm = 10.08, height_cm = 21.8,
    weight_kg = 8.6, volume_cm3 = 4245.45,
    pallet_spaces = 34, units_per_pallet = 34,
    updated_at = NOW()
WHERE material_code = 'RM101406';
UPDATE materials SET
    length_cm = 23.18, width_cm = 13.73, height_cm = 18.48,
    weight_kg = 8.48, volume_cm3 = 5881.47,
    pallet_spaces = 21, units_per_pallet = 21,
    updated_at = NOW()
WHERE material_code = 'RM101407';
UPDATE materials SET
    length_cm = 17.45, width_cm = 15.36, height_cm = 24.48,
    weight_kg = 28.93, volume_cm3 = 6561.42,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101409';
UPDATE materials SET
    length_cm = 12.81, width_cm = 15.94, height_cm = 23.17,
    weight_kg = 11.55, volume_cm3 = 4731.11,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101410';
UPDATE materials SET
    length_cm = 17.23, width_cm = 15.64, height_cm = 24.73,
    weight_kg = 18.41, volume_cm3 = 6664.17,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101411';
UPDATE materials SET
    length_cm = 15.55, width_cm = 14.18, height_cm = 11.78,
    weight_kg = 23.95, volume_cm3 = 2597.48,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101413';
UPDATE materials SET
    length_cm = 39.11, width_cm = 56.23, height_cm = 41.25,
    weight_kg = 142.1, volume_cm3 = 90715.16,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101415';
UPDATE materials SET
    length_cm = 23.8, width_cm = 12.45, height_cm = 20.02,
    weight_kg = 9.73, volume_cm3 = 5932.13,
    pallet_spaces = 32, units_per_pallet = 32,
    updated_at = NOW()
WHERE material_code = 'RM101416';
UPDATE materials SET
    length_cm = 62.41, width_cm = 29.23, height_cm = 30.45,
    weight_kg = 10.36, volume_cm3 = 55548.24,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM101428';
UPDATE materials SET
    length_cm = 68.38, width_cm = 23.77, height_cm = 26.88,
    weight_kg = 7.42, volume_cm3 = 43690.55,
    pallet_spaces = 12, units_per_pallet = 12,
    updated_at = NOW()
WHERE material_code = 'RM101429';
UPDATE materials SET
    length_cm = 18.1, width_cm = 22.13, height_cm = 24.62,
    weight_kg = 2.48, volume_cm3 = 9861.61,
    pallet_spaces = 38, units_per_pallet = 38,
    updated_at = NOW()
WHERE material_code = 'RM101443';
UPDATE materials SET
    length_cm = 19.78, width_cm = 18.71, height_cm = 19.51,
    weight_kg = 13.16, volume_cm3 = 7220.33,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101453';
UPDATE materials SET
    length_cm = 46.04, width_cm = 59.81, height_cm = 89.85,
    weight_kg = 34.09, volume_cm3 = 247415.67,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101463';
UPDATE materials SET
    length_cm = 78.11, width_cm = 38.06, height_cm = 20.9,
    weight_kg = 28.4, volume_cm3 = 62132.91,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101466';
UPDATE materials SET
    length_cm = 67.05, width_cm = 21.2, height_cm = 36.69,
    weight_kg = 8.89, volume_cm3 = 52153.37,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101467';
UPDATE materials SET
    length_cm = 92.09, width_cm = 38.31, height_cm = 31.35,
    weight_kg = 14.93, volume_cm3 = 110601.79,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101468';
UPDATE materials SET
    length_cm = 63.79, width_cm = 39.38, height_cm = 26.21,
    weight_kg = 9.73, volume_cm3 = 65840.84,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101469';
UPDATE materials SET
    length_cm = 77.16, width_cm = 39.29, height_cm = 21.89,
    weight_kg = 26.68, volume_cm3 = 66362.08,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101470';
UPDATE materials SET
    length_cm = 109.8, width_cm = 39.52, height_cm = 36.84,
    weight_kg = 28.58, volume_cm3 = 159859.66,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101471';
UPDATE materials SET
    length_cm = 67.62, width_cm = 35.92, height_cm = 30.91,
    weight_kg = 18.59, volume_cm3 = 75077.62,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM101472';
UPDATE materials SET
    length_cm = 24.58, width_cm = 17.05, height_cm = 17.24,
    weight_kg = 13.96, volume_cm3 = 7225.09,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'RM101474';
UPDATE materials SET
    length_cm = 15.42, width_cm = 13.92, height_cm = 11.35,
    weight_kg = 2.78, volume_cm3 = 2436.24,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101483';
UPDATE materials SET
    length_cm = 23.96, width_cm = 16.12, height_cm = 10.53,
    weight_kg = 5.15, volume_cm3 = 4067.06,
    pallet_spaces = 24, units_per_pallet = 24,
    updated_at = NOW()
WHERE material_code = 'RM101488';
UPDATE materials SET
    length_cm = 24.64, width_cm = 12.19, height_cm = 17.74,
    weight_kg = 28.12, volume_cm3 = 5328.41,
    pallet_spaces = 26, units_per_pallet = 26,
    updated_at = NOW()
WHERE material_code = 'RM101489';
UPDATE materials SET
    length_cm = 15.74, width_cm = 16.54, height_cm = 15.63,
    weight_kg = 5.68, volume_cm3 = 4069.11,
    pallet_spaces = 39, units_per_pallet = 39,
    updated_at = NOW()
WHERE material_code = 'RM101493';
UPDATE materials SET
    length_cm = 57.06, width_cm = 43.25, height_cm = 18.06,
    weight_kg = 38.78, volume_cm3 = 44569.28,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101496';
UPDATE materials SET
    length_cm = 54.02, width_cm = 48.53, height_cm = 84.94,
    weight_kg = 238.49, volume_cm3 = 222677.91,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101499';
UPDATE materials SET
    length_cm = 55.45, width_cm = 56.13, height_cm = 88.06,
    weight_kg = 216.2, volume_cm3 = 274078.69,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101500';
UPDATE materials SET
    length_cm = 46.21, width_cm = 35.48, height_cm = 56.68,
    weight_kg = 171.97, volume_cm3 = 92928.61,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101503';
UPDATE materials SET
    length_cm = 43.04, width_cm = 36.86, height_cm = 77.54,
    weight_kg = 63.0, volume_cm3 = 123013.67,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101505';
UPDATE materials SET
    length_cm = 43.22, width_cm = 34.95, height_cm = 17.79,
    weight_kg = 35.25, volume_cm3 = 26872.49,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101515';
UPDATE materials SET
    length_cm = 18.73, width_cm = 24.92, height_cm = 17.29,
    weight_kg = 12.21, volume_cm3 = 8070.14,
    pallet_spaces = 37, units_per_pallet = 37,
    updated_at = NOW()
WHERE material_code = 'RM101516';
UPDATE materials SET
    length_cm = 11.34, width_cm = 18.89, height_cm = 13.42,
    weight_kg = 16.12, volume_cm3 = 2874.73,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM101517';
UPDATE materials SET
    length_cm = 31.53, width_cm = 59.44, height_cm = 64.39,
    weight_kg = 180.9, volume_cm3 = 120676.08,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101525';
UPDATE materials SET
    length_cm = 27.33, width_cm = 21.48, height_cm = 22.82,
    weight_kg = 11.28, volume_cm3 = 13396.44,
    pallet_spaces = 21, units_per_pallet = 21,
    updated_at = NOW()
WHERE material_code = 'RM101534';
UPDATE materials SET
    length_cm = 19.57, width_cm = 18.56, height_cm = 19.47,
    weight_kg = 10.76, volume_cm3 = 7071.88,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101565';
UPDATE materials SET
    length_cm = 24.41, width_cm = 13.71, height_cm = 16.38,
    weight_kg = 24.46, volume_cm3 = 5481.75,
    pallet_spaces = 21, units_per_pallet = 21,
    updated_at = NOW()
WHERE material_code = 'RM101566';
UPDATE materials SET
    length_cm = 21.05, width_cm = 14.6, height_cm = 13.23,
    weight_kg = 22.48, volume_cm3 = 4065.98,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM101567';
UPDATE materials SET
    length_cm = 22.54, width_cm = 21.21, height_cm = 23.42,
    weight_kg = 7.18, volume_cm3 = 11196.48,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101574';
UPDATE materials SET
    length_cm = 12.21, width_cm = 24.34, height_cm = 12.32,
    weight_kg = 5.34, volume_cm3 = 3661.4,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101575';
UPDATE materials SET
    length_cm = 17.94, width_cm = 18.83, height_cm = 21.41,
    weight_kg = 21.39, volume_cm3 = 7232.52,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101576';
UPDATE materials SET
    length_cm = 15.37, width_cm = 14.78, height_cm = 12.21,
    weight_kg = 8.57, volume_cm3 = 2773.73,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101577';
UPDATE materials SET
    length_cm = 51.15, width_cm = 32.1, height_cm = 65.02,
    weight_kg = 201.0, volume_cm3 = 106757.31,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101580';
UPDATE materials SET
    length_cm = 26.3, width_cm = 16.72, height_cm = 22.31,
    weight_kg = 6.4, volume_cm3 = 9810.51,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101581';
UPDATE materials SET
    length_cm = 35.29, width_cm = 44.02, height_cm = 60.39,
    weight_kg = 79.21, volume_cm3 = 93813.8,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101582';
UPDATE materials SET
    length_cm = 14.71, width_cm = 12.73, height_cm = 11.96,
    weight_kg = 13.45, volume_cm3 = 2239.61,
    pallet_spaces = 22, units_per_pallet = 22,
    updated_at = NOW()
WHERE material_code = 'RM101583';
UPDATE materials SET
    length_cm = 37.08, width_cm = 52.89, height_cm = 88.36,
    weight_kg = 107.12, volume_cm3 = 173288.2,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101584';
UPDATE materials SET
    length_cm = 59.34, width_cm = 59.99, height_cm = 89.29,
    weight_kg = 191.18, volume_cm3 = 317855.13,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101593';
UPDATE materials SET
    length_cm = 21.87, width_cm = 14.61, height_cm = 11.22,
    weight_kg = 0.97, volume_cm3 = 3585.02,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'RM101594';
UPDATE materials SET
    length_cm = 17.41, width_cm = 14.07, height_cm = 18.52,
    weight_kg = 16.79, volume_cm3 = 4536.64,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'RM101595';
UPDATE materials SET
    length_cm = 36.76, width_cm = 53.79, height_cm = 84.09,
    weight_kg = 248.84, volume_cm3 = 166272.87,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101597';
UPDATE materials SET
    length_cm = 27.8, width_cm = 14.72, height_cm = 16.02,
    weight_kg = 7.07, volume_cm3 = 6555.64,
    pallet_spaces = 33, units_per_pallet = 33,
    updated_at = NOW()
WHERE material_code = 'RM101603';
UPDATE materials SET
    length_cm = 28.78, width_cm = 15.17, height_cm = 18.36,
    weight_kg = 7.76, volume_cm3 = 8015.84,
    pallet_spaces = 25, units_per_pallet = 25,
    updated_at = NOW()
WHERE material_code = 'RM101604';
UPDATE materials SET
    length_cm = 12.55, width_cm = 11.95, height_cm = 10.87,
    weight_kg = 28.5, volume_cm3 = 1630.2,
    pallet_spaces = 23, units_per_pallet = 23,
    updated_at = NOW()
WHERE material_code = 'RM101605';
UPDATE materials SET
    length_cm = 50.44, width_cm = 35.76, height_cm = 49.12,
    weight_kg = 207.7, volume_cm3 = 88599.43,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101613';
UPDATE materials SET
    length_cm = 23.7, width_cm = 11.4, height_cm = 20.17,
    weight_kg = 24.53, volume_cm3 = 5449.53,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM101615';
UPDATE materials SET
    length_cm = 24.47, width_cm = 12.65, height_cm = 16.45,
    weight_kg = 13.26, volume_cm3 = 5092.02,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101617';
UPDATE materials SET
    length_cm = 21.64, width_cm = 17.72, height_cm = 15.67,
    weight_kg = 25.14, volume_cm3 = 6008.83,
    pallet_spaces = 25, units_per_pallet = 25,
    updated_at = NOW()
WHERE material_code = 'RM101623';
UPDATE materials SET
    length_cm = 94.27, width_cm = 39.88, height_cm = 20.77,
    weight_kg = 10.2, volume_cm3 = 78084.56,
    pallet_spaces = 7, units_per_pallet = 7,
    updated_at = NOW()
WHERE material_code = 'RM101625';
UPDATE materials SET
    length_cm = 17.78, width_cm = 18.1, height_cm = 11.34,
    weight_kg = 12.16, volume_cm3 = 3649.42,
    pallet_spaces = 12, units_per_pallet = 12,
    updated_at = NOW()
WHERE material_code = 'RM101637';
UPDATE materials SET
    length_cm = 13.78, width_cm = 12.93, height_cm = 16.15,
    weight_kg = 12.25, volume_cm3 = 2877.53,
    pallet_spaces = 30, units_per_pallet = 30,
    updated_at = NOW()
WHERE material_code = 'RM101653';
UPDATE materials SET
    length_cm = 27.24, width_cm = 19.63, height_cm = 20.36,
    weight_kg = 24.58, volume_cm3 = 10886.92,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101697';
UPDATE materials SET
    length_cm = 52.1, width_cm = 43.47, height_cm = 13.69,
    weight_kg = 41.89, volume_cm3 = 31004.93,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101698';
UPDATE materials SET
    length_cm = 105.27, width_cm = 21.96, height_cm = 29.36,
    weight_kg = 10.01, volume_cm3 = 67872.37,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101699';
UPDATE materials SET
    length_cm = 21.96, width_cm = 17.89, height_cm = 22.96,
    weight_kg = 22.78, volume_cm3 = 9020.17,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101700';
UPDATE materials SET
    length_cm = 26.05, width_cm = 13.99, height_cm = 14.11,
    weight_kg = 6.74, volume_cm3 = 5142.24,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM101701';
UPDATE materials SET
    length_cm = 58.31, width_cm = 42.06, height_cm = 51.68,
    weight_kg = 171.63, volume_cm3 = 126746.16,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101702';
UPDATE materials SET
    length_cm = 10.7, width_cm = 12.43, height_cm = 19.59,
    weight_kg = 19.68, volume_cm3 = 2605.49,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101733';
UPDATE materials SET
    length_cm = 57.52, width_cm = 55.53, height_cm = 84.12,
    weight_kg = 57.12, volume_cm3 = 268686.48,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101734';
UPDATE materials SET
    length_cm = 59.34, width_cm = 56.53, height_cm = 89.33,
    weight_kg = 180.8, volume_cm3 = 299656.61,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101735';
UPDATE materials SET
    length_cm = 58.16, width_cm = 51.85, height_cm = 62.94,
    weight_kg = 177.19, volume_cm3 = 189801.61,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101736';
UPDATE materials SET
    length_cm = 21.17, width_cm = 18.21, height_cm = 21.24,
    weight_kg = 8.99, volume_cm3 = 8188.14,
    pallet_spaces = 15, units_per_pallet = 15,
    updated_at = NOW()
WHERE material_code = 'RM101737';
UPDATE materials SET
    length_cm = 20.06, width_cm = 17.58, height_cm = 18.74,
    weight_kg = 10.18, volume_cm3 = 6608.75,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101738';
UPDATE materials SET
    length_cm = 25.74, width_cm = 23.7, height_cm = 13.7,
    weight_kg = 18.54, volume_cm3 = 8357.52,
    pallet_spaces = 14, units_per_pallet = 14,
    updated_at = NOW()
WHERE material_code = 'RM101739';
UPDATE materials SET
    length_cm = 20.46, width_cm = 12.83, height_cm = 21.93,
    weight_kg = 24.04, volume_cm3 = 5756.66,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101740';
UPDATE materials SET
    length_cm = 20.83, width_cm = 19.18, height_cm = 24.76,
    weight_kg = 10.89, volume_cm3 = 9892.1,
    pallet_spaces = 13, units_per_pallet = 13,
    updated_at = NOW()
WHERE material_code = 'RM101742';
UPDATE materials SET
    length_cm = 24.8, width_cm = 10.94, height_cm = 16.19,
    weight_kg = 26.33, volume_cm3 = 4392.54,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'RM101760';
UPDATE materials SET
    length_cm = 30.76, width_cm = 18.83, height_cm = 29.7,
    weight_kg = 26.62, volume_cm3 = 17202.56,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101762';
UPDATE materials SET
    length_cm = 21.55, width_cm = 13.37, height_cm = 19.1,
    weight_kg = 19.93, volume_cm3 = 5503.16,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101763';
UPDATE materials SET
    length_cm = 10.37, width_cm = 12.2, height_cm = 20.68,
    weight_kg = 17.12, volume_cm3 = 2616.31,
    pallet_spaces = 19, units_per_pallet = 19,
    updated_at = NOW()
WHERE material_code = 'RM101766';
UPDATE materials SET
    length_cm = 15.22, width_cm = 18.65, height_cm = 10.46,
    weight_kg = 12.19, volume_cm3 = 2969.1,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101768';
UPDATE materials SET
    length_cm = 10.76, width_cm = 17.5, height_cm = 13.86,
    weight_kg = 26.06, volume_cm3 = 2609.84,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101783';
UPDATE materials SET
    length_cm = 14.32, width_cm = 17.97, height_cm = 21.69,
    weight_kg = 6.52, volume_cm3 = 5581.5,
    pallet_spaces = 30, units_per_pallet = 30,
    updated_at = NOW()
WHERE material_code = 'RM101784';
UPDATE materials SET
    length_cm = 13.46, width_cm = 10.27, height_cm = 24.38,
    weight_kg = 21.45, volume_cm3 = 3370.15,
    pallet_spaces = 6, units_per_pallet = 6,
    updated_at = NOW()
WHERE material_code = 'RM101785';
UPDATE materials SET
    length_cm = 17.97, width_cm = 14.76, height_cm = 16.74,
    weight_kg = 19.39, volume_cm3 = 4440.07,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'RM101786';
UPDATE materials SET
    length_cm = 28.32, width_cm = 23.12, height_cm = 18.5,
    weight_kg = 14.89, volume_cm3 = 12113.03,
    pallet_spaces = 8, units_per_pallet = 8,
    updated_at = NOW()
WHERE material_code = 'RM101793';
UPDATE materials SET
    length_cm = 29.45, width_cm = 23.54, height_cm = 23.83,
    weight_kg = 8.64, volume_cm3 = 16520.22,
    pallet_spaces = 9, units_per_pallet = 9,
    updated_at = NOW()
WHERE material_code = 'RM101794';
UPDATE materials SET
    length_cm = 18.38, width_cm = 17.12, height_cm = 16.35,
    weight_kg = 4.48, volume_cm3 = 5144.78,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101796';
UPDATE materials SET
    length_cm = 59.69, width_cm = 32.22, height_cm = 46.89,
    weight_kg = 168.04, volume_cm3 = 90179.4,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101797';
UPDATE materials SET
    length_cm = 63.23, width_cm = 37.62, height_cm = 23.23,
    weight_kg = 39.15, volume_cm3 = 55257.49,
    pallet_spaces = 11, units_per_pallet = 11,
    updated_at = NOW()
WHERE material_code = 'RM101798';
UPDATE materials SET
    length_cm = 51.38, width_cm = 43.42, height_cm = 58.0,
    weight_kg = 101.52, volume_cm3 = 129393.34,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101799';
UPDATE materials SET
    length_cm = 53.9, width_cm = 37.82, height_cm = 47.98,
    weight_kg = 60.58, volume_cm3 = 97807.13,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101800';
UPDATE materials SET
    length_cm = 50.58, width_cm = 55.69, height_cm = 44.04,
    weight_kg = 156.53, volume_cm3 = 124051.88,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101806';
UPDATE materials SET
    length_cm = 18.25, width_cm = 21.89, height_cm = 24.1,
    weight_kg = 8.08, volume_cm3 = 9627.77,
    pallet_spaces = 39, units_per_pallet = 39,
    updated_at = NOW()
WHERE material_code = 'RM101807';
UPDATE materials SET
    length_cm = 38.7, width_cm = 46.63, height_cm = 72.34,
    weight_kg = 127.91, volume_cm3 = 130543.39,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101812';
UPDATE materials SET
    length_cm = 34.05, width_cm = 50.81, height_cm = 75.09,
    weight_kg = 141.28, volume_cm3 = 129911.74,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101814';
UPDATE materials SET
    length_cm = 42.27, width_cm = 32.6, height_cm = 51.56,
    weight_kg = 96.58, volume_cm3 = 71049.78,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101819';
UPDATE materials SET
    length_cm = 13.56, width_cm = 18.3, height_cm = 18.19,
    weight_kg = 22.93, volume_cm3 = 4513.81,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101821';
UPDATE materials SET
    length_cm = 19.3, width_cm = 19.28, height_cm = 17.38,
    weight_kg = 16.1, volume_cm3 = 6467.17,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101822';
UPDATE materials SET
    length_cm = 24.75, width_cm = 11.08, height_cm = 17.74,
    weight_kg = 12.3, volume_cm3 = 4864.84,
    pallet_spaces = 22, units_per_pallet = 22,
    updated_at = NOW()
WHERE material_code = 'RM101823';
UPDATE materials SET
    length_cm = 44.81, width_cm = 44.05, height_cm = 90.03,
    weight_kg = 98.36, volume_cm3 = 177708.46,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101824';
UPDATE materials SET
    length_cm = 36.51, width_cm = 32.86, height_cm = 40.03,
    weight_kg = 94.91, volume_cm3 = 48024.74,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101825';
UPDATE materials SET
    length_cm = 10.64, width_cm = 18.55, height_cm = 12.31,
    weight_kg = 23.56, volume_cm3 = 2429.65,
    pallet_spaces = 31, units_per_pallet = 31,
    updated_at = NOW()
WHERE material_code = 'RM101826';
UPDATE materials SET
    length_cm = 35.02, width_cm = 48.8, height_cm = 56.96,
    weight_kg = 133.69, volume_cm3 = 97343.27,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101827';
UPDATE materials SET
    length_cm = 14.61, width_cm = 23.59, height_cm = 17.5,
    weight_kg = 19.02, volume_cm3 = 6031.37,
    pallet_spaces = 18, units_per_pallet = 18,
    updated_at = NOW()
WHERE material_code = 'RM101828';
UPDATE materials SET
    length_cm = 26.99, width_cm = 24.98, height_cm = 13.36,
    weight_kg = 7.53, volume_cm3 = 9007.45,
    pallet_spaces = 16, units_per_pallet = 16,
    updated_at = NOW()
WHERE material_code = 'RM101830';
UPDATE materials SET
    length_cm = 13.94, width_cm = 15.82, height_cm = 24.9,
    weight_kg = 29.71, volume_cm3 = 5491.22,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101831';
UPDATE materials SET
    length_cm = 59.17, width_cm = 42.2, height_cm = 23.99,
    weight_kg = 26.12, volume_cm3 = 59902.41,
    pallet_spaces = 10, units_per_pallet = 10,
    updated_at = NOW()
WHERE material_code = 'RM101832';
UPDATE materials SET
    length_cm = 22.49, width_cm = 13.03, height_cm = 16.6,
    weight_kg = 29.58, volume_cm3 = 4864.54,
    pallet_spaces = 17, units_per_pallet = 17,
    updated_at = NOW()
WHERE material_code = 'RM101833';
UPDATE materials SET
    length_cm = 23.59, width_cm = 17.98, height_cm = 14.04,
    weight_kg = 9.97, volume_cm3 = 5955.04,
    pallet_spaces = 20, units_per_pallet = 20,
    updated_at = NOW()
WHERE material_code = 'RM101835';
UPDATE materials SET
    length_cm = 45.17, width_cm = 49.1, height_cm = 61.23,
    weight_kg = 153.6, volume_cm3 = 135798.77,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101836';
UPDATE materials SET
    length_cm = 39.92, width_cm = 33.82, height_cm = 49.81,
    weight_kg = 172.35, volume_cm3 = 67248.2,
    pallet_spaces = 3, units_per_pallet = 3,
    updated_at = NOW()
WHERE material_code = 'RM101838';
UPDATE materials SET
    length_cm = 58.8, width_cm = 57.77, height_cm = 85.15,
    weight_kg = 145.31, volume_cm3 = 289243.99,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101839';
UPDATE materials SET
    length_cm = 35.31, width_cm = 49.68, height_cm = 54.3,
    weight_kg = 27.02, volume_cm3 = 95253.1,
    pallet_spaces = 1, units_per_pallet = 1,
    updated_at = NOW()
WHERE material_code = 'RM101840';
UPDATE materials SET
    length_cm = 40.65, width_cm = 41.98, height_cm = 12.33,
    weight_kg = 38.2, volume_cm3 = 21040.98,
    pallet_spaces = 4, units_per_pallet = 4,
    updated_at = NOW()
WHERE material_code = 'RM101841';
UPDATE materials SET
    length_cm = 57.22, width_cm = 57.21, height_cm = 85.5,
    weight_kg = 184.22, volume_cm3 = 279889.06,
    pallet_spaces = 2, units_per_pallet = 2,
    updated_at = NOW()
WHERE material_code = 'RM101842';
UPDATE materials SET
    length_cm = 10.17, width_cm = 11.79, height_cm = 23.56,
    weight_kg = 16.71, volume_cm3 = 2824.95,
    pallet_spaces = 27, units_per_pallet = 27,
    updated_at = NOW()
WHERE material_code = 'RM101859';
UPDATE materials SET
    length_cm = 13.04, width_cm = 16.6, height_cm = 20.87,
    weight_kg = 18.18, volume_cm3 = 4517.6,
    pallet_spaces = 28, units_per_pallet = 28,
    updated_at = NOW()
WHERE material_code = 'RM101862';

-- Heuristic backfill for V16 numeric materials missing real dimensions
UPDATE materials SET
    length_cm = COALESCE(length_cm, 40),
    width_cm = COALESCE(width_cm, 30),
    height_cm = COALESCE(height_cm, 25),
    weight_kg = CASE
        WHEN weight_kg IS NULL OR weight_kg <= 1 THEN
            CASE material_type
                WHEN 'raw_material' THEN 25
                WHEN 'packaging_material' THEN 8
                ELSE 12
            END
        ELSE weight_kg
    END,
    volume_cm3 = COALESCE(volume_cm3,
        COALESCE(length_cm, 40) * COALESCE(width_cm, 30) * COALESCE(height_cm, 25)),
    pallet_spaces = COALESCE(pallet_spaces, COALESCE(units_per_pallet, 48)),
    units_per_pallet = COALESCE(units_per_pallet, COALESCE(pallet_spaces, 48)),
    updated_at = NOW()
WHERE length_cm IS NULL OR width_cm IS NULL OR height_cm IS NULL
   OR weight_kg IS NULL OR weight_kg <= 1
   OR volume_cm3 IS NULL OR volume_cm3 <= 1000
   OR pallet_spaces IS NULL OR pallet_spaces <= 1;