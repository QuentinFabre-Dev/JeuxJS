class Rect{
    constructor(x, y, width, height, color, context) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.context = context;
        this.context.fillStyle = this.color;
    }
    draw() {
        context.save();
        context.fillStyle = this.color;
        context.translate(cWidth/4, cHeight/4);
        context.fillRect(this.x, this.y, this.width, this.height);
        context.restore();
    }
}