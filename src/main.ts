import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  Logger,
  VersioningType,
  BadRequestException,
  HttpStatus
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Khởi tạo logger
  const logger = new Logger('Bootstrap');

  try {
    // Tạo app với NestExpressApplication để có thêm các phương thức của Express
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'], // Cấu hình log level
      cors: true,
      bodyParser: true,
    });

    // ==================== MIDDLEWARE GLOBAL ====================

    // Compression cho responses
    app.use(compression());

    // Bảo mật với helmet
    app.use(helmet.default({
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Cho phép truy cập file tĩnh
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Cookie parser
    app.use(cookieParser());

    // Parse JSON và URL encoded với giới hạn kích thước
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    // ==================== GLOBAL PIPES ====================

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, // Loại bỏ các field không có trong DTO
      forbidNonWhitelisted: true, // Throw error nếu có field không được phép
      forbidUnknownValues: true, // Throw error nếu có unknown values
      transform: true, // Tự động transform kiểu dữ liệu
      transformOptions: {
        enableImplicitConversion: true, // Cho phép implicit conversion
      },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      exceptionFactory: (errors) => {
        const messages = errors.map(error => {
          return {
            field: error.property,
            constraints: error.constraints,
          };
        });
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errors: messages,
        });
      },
    }));

    // ==================== GLOBAL FILTERS ====================

    // Có thể thêm global filters ở đây
    // app.useGlobalFilters(new HttpExceptionFilter());

    // ==================== GLOBAL GUARDS ====================

    // Có thể thêm global guards ở đây
    // app.useGlobalGuards(new RolesGuard());

    // ==================== API VERSIONING ====================

    app.enableVersioning({
      type: VersioningType.URI, // Version qua URI: /api/v1/...
      prefix: 'api/v', // Prefix: api/v1, api/v2
      defaultVersion: '1',
    });

    // ==================== STATIC FILES ====================

    // Phục vụ file tĩnh từ thư mục uploads
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
      prefix: '/uploads/',
      index: false,
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'py'],
      setHeaders: (res, path) => {
        // Set cache control cho file tĩnh
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      },
    });

    // Phục vụ file tĩnh từ thư mục public
    app.useStaticAssets(join(__dirname, '..', 'public'), {
      prefix: '/public/',
      index: false,
    });

    // ==================== CORS CONFIGURATION ====================

    app.enableCors({
      origin: process.env.FRONTEND_URL?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-API-Key',
      ],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 3600, // Cache preflight requests trong 1 giờ
    });

    // ==================== SWAGGER CONFIGURATION ====================

    // Chỉ enable Swagger trong môi trường development
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Trading Platform API')
        .setDescription(`
          API documentation for Trading Platform with backtesting capabilities.
          
          ## Features
          * User authentication & authorization
          * Strategy management
          * Backtesting engine
          * Real-time updates via WebSocket
          * File upload for Python strategies
          
          ## Authentication
          This API uses JWT Bearer tokens for authentication.
          To authenticate, click the 'Authorize' button and enter your token.
        `)
        .setVersion('1.0')
        .setContact('Support Team', 'https://tradingplatform.com/support', 'support@tradingplatform.com')
        .setLicense('MIT', 'https://opensource.org/licenses/MIT')
        .setTermsOfService('https://tradingplatform.com/terms')

        // Tags
        .addTag('auth', '🔐 Authentication endpoints - Register, login, logout')
        .addTag('users', '👥 User management endpoints')
        .addTag('strategies', '📊 Strategy management endpoints')
        .addTag('backtest', '📈 Backtest endpoints')
        .addTag('organizations', '🏢 Organization management endpoints')
        .addTag('health', '❤️ Health check endpoints')

        // Security Schemes
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'JWT',
            description: 'Enter JWT token',
            in: 'header',
          },
          'JWT-auth',
        )
        .addBasicAuth(
          {
            type: 'http',
            scheme: 'basic',
            description: 'Enter username and password',
          },
          'basic-auth',
        )
        .addApiKey(
          {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'Enter API key for service-to-service communication',
          },
          'api-key',
        )

        // Servers
        .addServer('http://localhost:3000', 'Local Development Server')
        .addServer('https://api.tradingplatform.com', 'Production Server')

        .build();

      const document = SwaggerModule.createDocument(app, config, {
        deepScanRoutes: true,
        operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
      });

      // Tùy chỉnh UI Swagger
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
          docExpansion: 'list',
          filter: true,
          showRequestDuration: true,
          tryItOutEnabled: true,
          displayRequestDuration: true,
          defaultModelsExpandDepth: 3,
          defaultModelExpandDepth: 3,
          syntaxHighlight: {
            activate: true,
            theme: 'monokai',
          },
        },
        // customCss: `
        //   .swagger-ui .topbar { display: none }
        //   .swagger-ui .info { margin: 30px 0 }
        //   .swagger-ui .scheme-container { 
        //     margin: 20px 0; 
        //     padding: 20px 0;
        //     background: #f8f9fa;
        //     border-radius: 8px;
        //   }
        //   .swagger-ui .btn.authorize {
        //     background-color: #28a745;
        //     border-color: #28a745;
        //     color: white;
        //   }
        //   .swagger-ui .btn.authorize svg {
        //     fill: white;
        //   }
        //   .swagger-ui .model-box {
        //     background: #f8f9fa;
        //     border-radius: 4px;
        //     padding: 10px;
        //   }
        //   .swagger-ui .response-col_status {
        //     font-weight: bold;
        //   }
        //   .swagger-ui table tbody tr td {
        //     padding: 10px;
        //   }
        //   .swagger-ui .opblock-tag {
        //     font-size: 20px;
        //     font-weight: bold;
        //     border-bottom: 2px solid #e9ecef;
        //   }
        //   .swagger-ui .opblock-tag:hover {
        //     background: #f8f9fa;
        //   }
        //   .swagger-ui .opblock {
        //     border-radius: 8px;
        //     box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        //   }
        //   .swagger-ui .opblock .opblock-summary {
        //     padding: 15px;
        //   }
        //   .swagger-ui .opblock .opblock-summary-path {
        //     font-weight: bold;
        //   }
        //   .swagger-ui .opblock .opblock-summary-description {
        //     font-style: italic;
        //   }
        // `,
        customSiteTitle: 'Trading Platform API Documentation',
        customfavIcon: 'https://tradingplatform.com/favicon.ico',
        customJs: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
        ],
      });

      // Swagger JSON endpoint
      app.use('/api/docs-json', (req, res) => {
        res.json(document);
      });

      logger.log('Swagger documentation initialized at /api/docs');
    }

    // ==================== GLOBAL PREFIX ====================

    // Set global prefix cho API (các route bắt đầu bằng /api)
    app.setGlobalPrefix('api', {
      exclude: [
        '/health',
        '/uploads/{*any}',
        '/public/{*any}',
        '/',
      ],
    });

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
      // Remove 'prefix: api/v' because 'api' is already the global prefix
    });

    // ==================== SHUTDOWN HOOKS ====================

    // Graceful shutdown
    app.enableShutdownHooks();

    // ==================== START SERVER ====================

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen(port, host);

    // Log server info
    logger.log(`🚀 Application is running on: http://${host}:${port}`);
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
    logger.log(`📊 Health Check: http://${host}:${port}/api/health`);
    logger.log(`📁 Uploads directory: ${join(__dirname, '..', 'uploads')}`);

    // Log environment
    logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Log all registered routes (debug mode)
    if (process.env.NODE_ENV === 'development') {
      // Get the underlying Express instance from the adapter
      const serverInstance = app.getHttpAdapter().getInstance();
      const router = serverInstance._router;

      if (router && router.stack) {
        const routes = router.stack
          .filter((layer: any) => layer.route)
          .map((layer: any) => {
            const path = layer.route?.path;
            const method = Object.keys(layer.route?.methods || {})[0]?.toUpperCase();
            return `${method} ${path}`;
          });

        logger.debug('Registered Routes:');
        routes.forEach((route: string) => logger.debug(route));
      } else {
        logger.warn('Router stack not found. Routes cannot be logged.');
      }
    }

  } catch (error) {
    logger.error(`❌ Error starting application: ${error.message}`);
    process.exit(1);
  }
}

// Xử lý unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Ghi log và thông báo cho admin
});

// Xử lý uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Ghi log và thông báo cho admin
  process.exit(1);
});

bootstrap();