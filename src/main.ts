import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
	const api = await NestFactory.create(AppModule, {
		logger: ['log', 'warn', 'error'],
	});

	api.enableCors({
		origin: ['https://zchf.app'],
	});

	// Global exception filter — standardised JSON error shape
	api.useGlobalFilters(new AllExceptionsFilter());

	// Global validation pipe — strips unknown fields, auto-transforms primitives
	api.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: false, // warn-only; tighten to true when all DTOs are complete
		})
	);

	// Swagger
	const config = new DocumentBuilder()
		.setTitle(process.env.npm_package_name)
		.setDescription(
			'REST API for the Frankencoin ecosystem providing real-time and historical data for the ZCHF stablecoin operations. ' +
			'Access ecosystem metrics, collateral positions, minter data, savings rates, price feeds, challenges, and analytics. ' +
			'TypeScript types and client utilities are available via the @frankencoin/api npm package.'
		)
		.setVersion(process.env.npm_package_version)
		.build();

	const document = SwaggerModule.createDocument(api, config);
	SwaggerModule.setup('/', api, document, {
		swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
	});

	await api.listen(process.env.PORT || 3000);
}

bootstrap();
