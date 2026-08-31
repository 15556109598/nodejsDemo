-- ============================================================
-- 小厨点餐 H5 —— 种子数据（先执行 schema.sql，再执行本文件）
-- ============================================================

insert into public.categories (id, name, sort) values
  (1, '热菜', 1),
  (2, '凉菜', 2),
  (3, '主食', 3),
  (4, '汤品', 4),
  (5, '饮品', 5);
select setval('public.categories_id_seq', 5, true);

insert into public.dishes (category_id, name, description, image_url, price, rating, monthly_sales, spiciness, specs) values
(1, '宫保鸡丁', '经典川菜，鸡丁滑嫩，花生酥脆，酸甜微辣', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Kung%20Pao%20chicken%20with%20peanuts%20and%20dried%20chili%20on%20white%20plate%2C%20Chinese%20food%20photography%2C%20warm%20light%2C%20glossy%20sauce%2C%20appetizing&image_size=landscape_4_3', 38.80, 4.8, 986, 1,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":6}]},{"name":"辣度","options":[{"label":"不辣","delta":0},{"label":"微辣","delta":0},{"label":"中辣","delta":0}]}]'::jsonb),
(1, '水煮鱼', '鲜嫩草鱼片，麻辣鲜香，豆芽垫底', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Sichuan%20boiled%20fish%20in%20red%20chili%20broth%20with%20bean%20sprouts%2C%20Chinese%20food%20photography%2C%20spicy%20appetizing&image_size=landscape_4_3', 58.00, 4.9, 663, 3,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":10}]},{"name":"辣度","options":[{"label":"微辣","delta":0},{"label":"中辣","delta":0},{"label":"特辣","delta":0}]}]'::jsonb),
(1, '红烧肉', '肥而不腻，入口即化，浓油赤酱', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Braised%20pork%20belly%20with%20glossy%20caramelized%20sauce%20on%20white%20plate%2C%20Chinese%20hongshaorou%2C%20food%20photography%2C%20appetizing&image_size=landscape_4_3', 45.00, 4.9, 1204, 0,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":8}]}]'::jsonb),
(1, '鱼香肉丝', '咸甜酸辣兼备，姜丝木耳爽脆', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Yu%20Xiang%20shredded%20pork%20with%20wood%20ear%20mushroom%20and%20carrot%20stir%20fry%2C%20Chinese%20food%20photography%2C%20warm%20light&image_size=landscape_4_3', 32.00, 4.7, 881, 1,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":5}]},{"name":"辣度","options":[{"label":"不辣","delta":0},{"label":"微辣","delta":0},{"label":"中辣","delta":0}]}]'::jsonb),
(1, '麻婆豆腐', '麻辣烫嫩酥香，下饭神器', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Mapo%20tofu%20with%20minced%20pork%20and%20chili%20oil%2C%20Sichuan%20cuisine%2C%20Chinese%20food%20photography%2C%20appetizing&image_size=landscape_4_3', 22.00, 4.6, 1502, 2,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":4}]},{"name":"辣度","options":[{"label":"微辣","delta":0},{"label":"中辣","delta":0},{"label":"特辣","delta":0}]}]'::jsonb),
(2, '拍黄瓜', '爽脆清凉，蒜香开胃', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Smashed%20cucumber%20salad%20with%20garlic%20and%20vinegar%2C%20Chinese%20cold%20dish%2C%20fresh%20green%2C%20food%20photography&image_size=landscape_4_3', 12.00, 4.5, 2003, 0, '[]'::jsonb),
(2, '口水鸡', '麻辣鲜香嫩滑，红油亮泽', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Sliced%20cold%20chicken%20with%20red%20chili%20oil%20sauce%20and%20sesame%2C%20Sichuan%20kou%20shui%20ji%2C%20Chinese%20cold%20dish%2C%20appetizing&image_size=landscape_4_3', 28.00, 4.8, 774, 2,
 '[{"name":"辣度","options":[{"label":"微辣","delta":0},{"label":"中辣","delta":0},{"label":"特辣","delta":0}]}]'::jsonb),
(2, '皮蛋豆腐', '嫩滑清爽，咸香适口', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Century%20egg%20with%20silken%20tofu%20cold%20appetizer%20with%20soy%20sauce%20and%20scallion%2C%20Chinese%20dish%2C%20fresh%20style&image_size=landscape_4_3', 14.00, 4.4, 905, 0, '[]'::jsonb),
(3, '扬州炒饭', '粒粒分明，虾仁火腿鸡蛋配料丰富', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Yangzhou%20fried%20rice%20with%20egg%20shrimp%20ham%20and%20green%20peas%2C%20Chinese%20food%20photography%2C%20appetizing&image_size=landscape_4_3', 18.00, 4.7, 2308, 0,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":4}]}]'::jsonb),
(3, '红烧牛肉面', '牛肉软烂，汤浓面弹', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Braised%20beef%20noodle%20soup%20with%20chili%20oil%20and%20scallion%2C%20Chinese%20noodles%20in%20bowl%2C%20appetizing%20food%20photography&image_size=landscape_4_3', 24.00, 4.8, 1806, 1,
 '[{"name":"份量","options":[{"label":"小份","delta":0},{"label":"大份","delta":5}]},{"name":"辣度","options":[{"label":"不辣","delta":0},{"label":"微辣","delta":0},{"label":"中辣","delta":0}]}]'::jsonb),
(3, '白米饭', '东北五常大米，颗颗晶莹', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Steamed%20white%20rice%20in%20a%20bowl%2C%20simple%20clean%20food%20photography%2C%20soft%20light&image_size=landscape_4_3', 3.00, 5.0, 5007, 0, '[]'::jsonb),
(4, '番茄蛋汤', '酸甜开胃，蛋花柔嫩', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Tomato%20egg%20drop%20soup%20in%20white%20bowl%20with%20scallion%2C%20Chinese%20home%20cooking%2C%20warm%20light&image_size=landscape_4_3', 10.00, 4.6, 1609, 0, '[]'::jsonb),
(4, '酸辣汤', '酸辣过瘾，胡椒暖胃', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Hot%20and%20sour%20soup%20with%20tofu%20mushroom%20and%20egg%2C%20Chinese%20suanlatang%2C%20appetizing%20food%20photography&image_size=landscape_4_3', 14.00, 4.5, 1108, 1,
 '[{"name":"辣度","options":[{"label":"微辣","delta":0},{"label":"中辣","delta":0},{"label":"特辣","delta":0}]}]'::jsonb),
(5, '鲜榨橙汁', '现榨现做，维C满满', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Fresh%20squeezed%20orange%20juice%20in%20glass%20with%20orange%20slices%2C%20bright%20refreshing%20drink%20photography&image_size=landscape_4_3', 15.00, 4.9, 883, 0,
 '[{"name":"规格","options":[{"label":"中杯","delta":0},{"label":"大杯","delta":3}]}]'::jsonb),
(5, '酸梅汤', '生津解腻，古法熬制', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Sour%20plum%20drink%20suanmeitang%20in%20glass%20with%20dried%20plums%20and%20mint%2C%20Chinese%20summer%20drink%2C%20refreshing&image_size=landscape_4_3', 8.00, 4.8, 1310, 0,
 '[{"name":"规格","options":[{"label":"中杯","delta":0},{"label":"大杯","delta":2}]}]'::jsonb);

-- 登录演示用户头像（注册后在个人中心展示，此处仅作默认占位说明，真实头像存于 profiles.avatar_url）
-- 如需默认头像，可手动执行：
-- update public.profiles set avatar_url = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Cute%20cartoon%20food%20lover%20avatar%2C%20flat%20illustration%2C%20orange%20background%2C%20kawaii%20style&image_size=square' where avatar_url is null;
