Función
CREATE OR REPLACE FUNCTION nombre_funcion(
    p_param1 IN tipo,
    p_param2 IN tipo
) RETURN tipo_retorno IS
    -- Variables locales
    v_variable tipo;
BEGIN
    -- Lógica: SELECT, cálculos, etc.
    SELECT columna INTO v_variable
    FROM tabla
    WHERE condicion = p_param1;
    
    -- Devolver resultado
    RETURN v_variable;
END;
/

SELECT nombre_funcion(valor1, valor2) FROM dual;

Procedimiento:
CREATE OR REPLACE PROCEDURE nombre_procedimiento(
    p_param1 IN tipo,
    p_param2 OUT tipo,
    p_param3 IN OUT tipo
) IS
    -- Variables locales
    v_variable tipo;
BEGIN
    -- Lógica: INSERT, UPDATE, DELETE, SELECT, etc.
    INSERT INTO tabla (col1, col2) VALUES (p_param1, v_variable);
    
    -- Asignar valores de salida
    p_param2 := v_variable;
    
    -- Opcional: COMMIT o ROLLBACK
    COMMIT;
END;
/
DECLARE
    v_salida tipo;
BEGIN
    nombre_procedimiento(valor1, v_salida);
    DBMS_OUTPUT.PUT_LINE(v_salida);
END;
/

Cursor Simple:
DECLARE
    -- Declaración del cursor
    CURSOR c_nombre IS
        SELECT col1, col2
        FROM tabla
        WHERE condiciones
        ORDER BY columna;
    
    -- Variables para el FETCH
    v_var1 tabla.col1%TYPE;
    v_var2 tabla.col2%TYPE;
BEGIN
    -- Título (opcional)
    DBMS_OUTPUT.PUT_LINE('TÍTULO DEL REPORTE');
    DBMS_OUTPUT.PUT_LINE('==================');
    
    OPEN c_nombre;
    LOOP
        FETCH c_nombre INTO v_var1, v_var2;
        EXIT WHEN c_nombre%NOTFOUND;
        
        -- Procesar cada fila
        DBMS_OUTPUT.PUT_LINE(v_var1 || ' ' || v_var2);
        
    END LOOP;
    CLOSE c_nombre;
END;
/

Cursor de 2 niveles:
DECLARE
    -- Cursor padre
    CURSOR c_padre IS
        SELECT id_padre, nombre
        FROM tabla_padre;
    
    v_id_padre tabla_padre.id_padre%TYPE;
    v_nombre_padre tabla_padre.nombre%TYPE;
    
    -- Cursor hijo (depende del padre)
    CURSOR c_hijo(p_id NUMBER) IS
        SELECT col_hijo
        FROM tabla_hijo
        WHERE id_relacion = p_id;
    
    v_col_hijo tabla_hijo.col_hijo%TYPE;
    v_contador NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('REPORTE PADRE-HIJO');
    DBMS_OUTPUT.PUT_LINE('==================');
    
    OPEN c_padre;
    LOOP
        FETCH c_padre INTO v_id_padre, v_nombre_padre;
        EXIT WHEN c_padre%NOTFOUND;
        
        DBMS_OUTPUT.PUT_LINE('PADRE: ' || v_nombre_padre);
        
        v_contador := 0;
        OPEN c_hijo(v_id_padre);
        LOOP
            FETCH c_hijo INTO v_col_hijo;
            EXIT WHEN c_hijo%NOTFOUND;
            
            v_contador := v_contador + 1;
            DBMS_OUTPUT.PUT_LINE('   ' || v_contador || '. ' || v_col_hijo);
        END LOOP;
        CLOSE c_hijo;
        
        IF v_contador = 0 THEN
            DBMS_OUTPUT.PUT_LINE('   Sin hijos');
        END IF;
        DBMS_OUTPUT.PUT_LINE('---');
    END LOOP;
    CLOSE c_padre;
END;
/
Función mas cursor:
CREATE OR REPLACE FUNCTION fn_calcular(p_param NUMBER)
RETURN NUMBER IS
    v_resultado NUMBER;
BEGIN
    -- Lógica: SELECT, cálculos, etc.
    v_resultado := p_param * 2;  -- Ejemplo simple
    RETURN v_resultado;
END;
/
DECLARE
    CURSOR c_datos IS
        SELECT id, nombre, valor
        FROM tabla_base;
    
    v_id tabla_base.id%TYPE;
    v_nombre tabla_base.nombre%TYPE;
    v_valor tabla_base.valor%TYPE;
    v_calculado NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('DATOS CON CÁLCULO');
    DBMS_OUTPUT.PUT_LINE('==================');
    
    OPEN c_datos;
    LOOP
        FETCH c_datos INTO v_id, v_nombre, v_valor;
        EXIT WHEN c_datos%NOTFOUND;
        
        -- Llamar a la función con el valor del cursor
        v_calculado := fn_calcular(v_valor);
        
        DBMS_OUTPUT.PUT_LINE(v_id || ' ' || v_nombre || ' ' || v_calculado);
    END LOOP;
    CLOSE c_datos;
END;
/
Trigger:
CREATE OR REPLACE TRIGGER tr_nombre
BEFORE|AFTER INSERT OR UPDATE OR DELETE ON nombre_tabla
FOR EACH ROW  -- Opcional
DECLARE
    -- Variables locales
    v_variable tipo;
BEGIN
    -- Lógica del trigger
    
    -- Usar :OLD y :NEW según la operación
    -- :OLD.columna  (valores antes del cambio)
    -- :NEW.columna  (valores después del cambio)
    
    -- Para validaciones que deben evitar la operación:
    IF condicion_error THEN
        RAISE_APPLICATION_ERROR(-20001, 'Mensaje de error');
    END IF;
    
    -- Para actualizar otras tablas:
    UPDATE otra_tabla SET columna = valor WHERE condicion;
    
    -- Para insertar en tablas de histórico:
    INSERT INTO historico_tabla VALUES (:OLD.col1, :OLD.col2, SYSDATE);
    
END;
/
-- FUNCIÓN
CREATE OR REPLACE FUNCTION fn_algo(p IN NUMBER) RETURN NUMBER IS v NUMBER; BEGIN SELECT COUNT(*) INTO v FROM tabla WHERE id = p; RETURN v; END;

-- PROCEDIMIENTO
CREATE OR REPLACE PROCEDURE sp_algo(p IN NUMBER) IS BEGIN UPDATE tabla SET col = valor WHERE id = p; COMMIT; END;

-- CURSOR SIMPLE
DECLARE CURSOR c IS SELECT col FROM tabla; v col%TYPE; BEGIN OPEN c; LOOP FETCH c INTO v; EXIT WHEN c%NOTFOUND; DBMS_OUTPUT.PUT_LINE(v); END LOOP; CLOSE c; END;

-- CURSOR ANIDADO
DECLARE CURSOR c1 IS SELECT id FROM t1; v_id t1.id%TYPE; CURSOR c2(p NUMBER) IS SELECT col FROM t2 WHERE fk = p; v_col t2.col%TYPE; BEGIN FOR r1 IN c1 LOOP FOR r2 IN c2(r1.id) LOOP DBMS_OUTPUT.PUT_LINE(r2.col); END LOOP; END LOOP; END;

-- TRIGGER
CREATE OR REPLACE TRIGGER tr_algo AFTER INSERT ON t FOR EACH ROW BEGIN UPDATE otra SET col = :N
