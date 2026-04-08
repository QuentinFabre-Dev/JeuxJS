class BoostBox extends Rect{
    constructor(x, y, width, height, color, context) {
        super(x,y,width,height,color,context);
        this.context.fillStyle = this.color;
        this.price = 10;
        this.level = 0;
      }
      draw() {
        context.save();
        context.fillStyle = this.color;
        context.translate(cWidth/4, cHeight/4);
        context.strokeRect(this.x, this.y, this.width, this.height);
        context.fillText(this.price +" $", this.x+this.width/2, this.y+this.height/2);
        context.restore();
    }
}