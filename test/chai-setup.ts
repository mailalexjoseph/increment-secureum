import chaiModule from 'chai';
import {chaiEthers} from 'chai-ethers';
chaiModule.use(chaiEthers); // should add waffle here? https://ethereum-waffle.readthedocs.io/en/latest/matchers.html#chai-matchers
export = chaiModule;
