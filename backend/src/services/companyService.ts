import mongoose from 'mongoose';
import { Company, ICompany, User, UserRole, Employee, LedgerTransaction } from '../models/index.js';
import { CreateCompanyInput, UpdateCompanyInput } from '../validators/index.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CompanyWithStats extends Omit<ICompany, keyof mongoose.Document> {
  id: string;
  employeeCount: number;
  totalBalance: number;
}

export async function createCompany(input: CreateCompanyInput): Promise<ICompany> {
  const existingCompany = await Company.findOne({
    $or: [{ cnpj: input.cnpj }, { email: input.email }],
  });

  if (existingCompany) {
    throw new ConflictError('Company with this CNPJ or email already exists');
  }

  const existingUser = await User.findOne({ email: input.viewerEmail });
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  const company = await Company.create({
    name: input.name,
    cnpj: input.cnpj,
    email: input.email,
    phone: input.phone,
    address: input.address,
  });

  await User.create({
    email: input.viewerEmail,
    password: input.viewerPassword,
    name: input.viewerName,
    role: UserRole.COMPANY_VIEWER,
    companyId: company._id,
  });

  logger.info({ companyId: company._id }, 'Company created successfully');

  return company;
}

export async function getAllCompanies(): Promise<CompanyWithStats[]> {
  const companies = await Company.aggregate([
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'companyId',
        as: 'employees',
      },
    },
    {
      $project: {
        id: '$_id',
        name: 1,
        cnpj: 1,
        email: 1,
        phone: 1,
        address: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        employeeCount: { $size: '$employees' },
        totalBalance: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$employees',
                  as: 'emp',
                  cond: { $eq: ['$$emp.isActive', true] },
                },
              },
              as: 'emp',
              in: '$$emp.balance',
            },
          },
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  return companies;
}

export async function getCompanyById(companyId: string): Promise<CompanyWithStats> {
  const [company] = await Company.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(companyId) },
    },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'companyId',
        as: 'employees',
      },
    },
    {
      $project: {
        id: '$_id',
        name: 1,
        cnpj: 1,
        email: 1,
        phone: 1,
        address: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        employeeCount: { $size: '$employees' },
        totalBalance: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$employees',
                  as: 'emp',
                  cond: { $eq: ['$$emp.isActive', true] },
                },
              },
              as: 'emp',
              in: '$$emp.balance',
            },
          },
        },
      },
    },
  ]);

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  return company;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput
): Promise<ICompany> {
  const company = await Company.findByIdAndUpdate(companyId, input, {
    new: true,
    runValidators: true,
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  logger.info({ companyId }, 'Company updated');

  return company;
}

export async function getCompanyOverview(companyId: string) {
  const company = await getCompanyById(companyId);

  const employeeCount = await Employee.countDocuments({ companyId, isActive: true });

  // Only return DEPOSIT and CREDIT_RESET transactions (no CONSUME - that's employee-only info)
  const transactions = await LedgerTransaction.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    type: { $in: ['DEPOSIT', 'CREDIT_RESET'] },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('employeeId', 'name email')
    .populate('companyId', 'name');

  return {
    company: {
      id: company.id,
      name: company.name,
    },
    stats: {
      totalEmployees: employeeCount,
    },
    transactions,
  };
}

export async function getCompanyViewer(companyId: string) {
  const viewer = await User.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    role: UserRole.COMPANY_VIEWER,
  }).select('name email');

  return viewer;
}

export async function updateCompanyViewer(
  companyId: string,
  input: { name?: string; email?: string; password?: string }
) {
  const viewer = await User.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    role: UserRole.COMPANY_VIEWER,
  });

  if (!viewer) {
    throw new NotFoundError('Company viewer not found');
  }

  if (input.email && input.email !== viewer.email) {
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }
    viewer.email = input.email;
  }

  if (input.name) {
    viewer.name = input.name;
  }

  if (input.password) {
    viewer.password = input.password;
  }

  await viewer.save();

  logger.info({ companyId, viewerId: viewer._id }, 'Company viewer updated');

  return { name: viewer.name, email: viewer.email };
}
