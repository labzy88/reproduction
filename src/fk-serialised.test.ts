import { Collection, Entity, ManyToOne, MikroORM, OneToMany, PrimaryKey, PrimaryKeyProp, Property, wrap, ref, Reference, Ref } from '@mikro-orm/sqlite';

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

  @ManyToOne({ primary: true, updateRule: 'cascade', deleteRule: 'cascade', ref: true })
  lender!: Ref<User>;

  @ManyToOne({ primary: true, updateRule: 'cascade', deleteRule: 'cascade', ref: true })
  debtor!: Ref<User>;

  @Property()
  amount: number = 0;

  constructor(lender: User, debtor: User) {
    this.lender = ref(lender)
    this.debtor = ref(debtor)
  }

}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User, Reference<User>, Debt],
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
  const debt = new Debt(new User('Foo', 'foo'), new User('Bar', 'bar'));

  await orm.em.persistAndFlush(debt);

  // [START] first check that populated works
  const lenderPopulated = await orm.em.findOneOrFail(Debt, { lender: debt.lender }, { populate: ['lender'] });
  expect(lenderPopulated.lender).toBeDefined();
  expect((lenderPopulated.lender as any).id).toBeUndefined();
  expect(typeof lenderPopulated.lender.$.id).toBe(typeof 0);
  expect(typeof lenderPopulated.lender.unwrap().id).toBe(typeof 0);

  const sLenderPopulated = wrap(lenderPopulated).toObject();
  expect(sLenderPopulated.lender).toBeDefined();
  expect(typeof sLenderPopulated.lender.id).toBe(typeof 0);

  // [START] unpopulated seems to be populated
  const lenderUnpopulated = await orm.em.findOneOrFail(Debt, { lender: debt.lender }, { populate: false });
  expect(typeof lenderUnpopulated.lender).toBe(typeof 0);
  expect((lenderUnpopulated.lender as any).id).toBeUndefined();
  expect(typeof lenderUnpopulated.lender.unwrap().id).toBe(typeof 0);

  const sLenderUnpopulated = wrap(lenderUnpopulated).toObject();
  expect(typeof sLenderUnpopulated.lender).toBe(typeof 0);
  expect((sLenderUnpopulated.lender as any).id).toBeUndefined();
});
