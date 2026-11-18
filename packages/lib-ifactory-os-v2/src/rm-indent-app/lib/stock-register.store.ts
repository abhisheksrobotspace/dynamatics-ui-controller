import type { StockRegisterRow } from './stock-register.types';

let rows: StockRegisterRow[] = [];

export function getStockRegisterRows(): StockRegisterRow[] {
	return rows;
}

export function setStockRegisterRows(next: StockRegisterRow[]): void {
	rows = next;
}
