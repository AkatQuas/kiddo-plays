module.exports = _ => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const quarter = ~~(month / 3) + 1;
    return {
        year,
        quarter,
        today: `${year}-${month + 1}-${date}`
    };
};