class Wave
{
    /* cette classe permet de générer une vague de zombies*/
    constructor(nbr)
    {
        this.nbr = nbr; //nombres de Zombies dans la wave initialisé à nbr
        this.list = []; // la liste des zombies dans la wave
        this.coef = 1; // permet d'augmenter le nombre de zombies à chaque wave
        this.wavecount = 0;
    }
    newwave()
    {
        this.wavecount++;
        for(var i = 0; i < this.nbr*this.coef; i++)
        {
            var positions = Tools.rndPlacement();
            this.list.push(new Zombies(positions[0],positions[1],imgZombie));
            this.list[i].wichSlab(dalles);
        }
        this.coef+=0.2;
    }
    displayTitle()  // rend la string correspondant au titre de la vague 'Vague X'
    {
        return "Vague "+this.wavecount+"";
    }
    displayWave() // rend la string correspondant au numéro de la Vague
    {
        return ''+this.wavecount+'';
    }
}
