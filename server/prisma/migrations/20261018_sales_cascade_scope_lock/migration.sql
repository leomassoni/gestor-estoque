CREATE TRIGGER gestor_stock_write_lock BEFORE INSERT OR UPDATE OR DELETE ON "AppCompanyRecord"
FOR EACH STATEMENT EXECUTE FUNCTION gestor_lock_stock_write();
