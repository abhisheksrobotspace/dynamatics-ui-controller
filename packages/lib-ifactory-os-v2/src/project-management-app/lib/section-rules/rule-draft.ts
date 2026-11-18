export type RuleDraft = {
	fromFlg: number;
	toFlg: number;
	fromThk: number;
	toThk: number;
	minLength: number;
	maxLength: number;
	endTrim: number;
	pitch: number;
};

export function emptyRuleDraft(): RuleDraft {
	return {
		fromFlg: 0,
		toFlg: 0,
		fromThk: 0,
		toThk: 0,
		minLength: 0,
		maxLength: 0,
		endTrim: 0,
		pitch: 0
	};
}
