ALTER TABLE anime ADD COLUMN start_date_source TEXT
    CHECK (start_date_source IS NULL OR start_date_source = 'history');

-- 具体补齐由数据库迁移器读取观看历史后执行，以应用时区解析 ISO 时间。
