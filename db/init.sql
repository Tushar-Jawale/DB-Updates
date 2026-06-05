CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    product_name  VARCHAR(255) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'shipped', 'delivered')),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    record RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        record := OLD;
    ELSE
        record := NEW;
    END IF;

    payload := json_build_object(
        'operation', TG_OP,
        'id',            record.id,
        'customer_name', record.customer_name,
        'product_name',  record.product_name,
        'status',        record.status,
        'updated_at',    record.updated_at
    );

    PERFORM pg_notify('orders_channel', payload::TEXT);

    RETURN record;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_notify
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_orders_change();

INSERT INTO orders (customer_name, product_name, status) VALUES
    ('Alice Johnson',  'Mechanical Keyboard', 'pending'),
    ('Bob Williams',   'Wireless Mouse',      'shipped'),
    ('Charlie Brown',  'USB-C Hub',           'delivered'),
    ('Diana Martinez', '27" Monitor',         'pending');
