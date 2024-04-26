import { Collection, Entity, ManyToOne, MikroORM, OneToMany, PrimaryKey, PrimaryKeyProp, Property, wrap } from '@mikro-orm/sqlite';

@Entity()
class User {

  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @OneToMany({ entity: () => Debt, mappedBy: 'lender', orphanRemoval: true })
  jncLenders = new Collection<Debt>(this);

  @OneToMany({ entity: () => Debt, mappedBy: 'debtor', orphanRemoval: true })
  jncDebtors = new Collection<Debt>(this);

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }

}

@Entity()
class Debt {

  [PrimaryKeyProp]?: ['lender', 'debtor'];

  @ManyToOne({ primary: true, updateRule: 'cascade', deleteRule: 'cascade' })
  lender!: User;

  @ManyToOne({ primary: true, updateRule: 'cascade', deleteRule: 'cascade' })
  debtor!: User;

  @Property()
  amount: number = 0;

}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User, Debt],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('basic CRUD example', async () => {
  orm.em.create(User, { name: 'Foo', email: 'foo' });
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(User, { email: 'foo' });
  expect(user.name).toBe('Foo');
  user.name = 'Bar';
  orm.em.remove(user);
  await orm.em.flush();

  const count = await orm.em.count(User, { email: 'foo' });
  expect(count).toBe(0);
});

test('FK when serialized', async () => {
  const debt = new Debt();
  debt.lender = new User('Foo', 'foo');
  debt.debtor = new User('Bar', 'bar');

  await orm.em.persistAndFlush(debt);

  // [START] first check that populated works
  const lenderPopulated = await orm.em.findOneOrFail(Debt, { lender: debt.lender }, { populate: ['lender'] });
  expect(lenderPopulated.lender.id).toBeDefined();

  const sLenderPopulated = wrap(lenderPopulated).toObject();
  expect(sLenderPopulated.lender).toBeDefined();
  expect(sLenderPopulated.lender.id).toBeDefined();

  // [START] unpopulated seems to be populated
  const lenderUnpopulated = await orm.em.findOneOrFail(Debt, { lender: debt.lender }, { populate: false });
  expect(lenderUnpopulated.lender).toBeDefined(); // should be FK
  expect(lenderUnpopulated.lender.id).toBeUndefined(); // should not exist ??

  const sLenderUnpopulated = wrap(lenderUnpopulated).toObject();
  expect(sLenderUnpopulated.lender).toBeDefined(); // should be FK
  expect(sLenderUnpopulated.lender.id).toBeUndefined(); // should no exist ??
});
